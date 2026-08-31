const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { test, after } = require("node:test");

// Use test-only configuration; database calls are stubbed below.
process.env.DATABASE_URL = "postgresql://test:test@127.0.0.1:1/test";
process.env.JWT_SECRET = "notification-test-secret";
process.env.MIDTRANS_SERVER_KEY = "notification-test-key";
process.env.MIDTRANS_IS_PRODUCTION = "false";

const { env } = require("../src/config/env.ts");
const { prisma } = require("../src/config/prisma.ts");
const { handleMidtransNotification } = require("../src/modules/public/public.controller.ts");

after(async () => { await prisma.$disconnect(); });

function signedPayload(orderId) {
  const payload = {
    order_id: orderId,
    status_code: "200",
    gross_amount: "10000.00",
    transaction_status: "settlement"
  };
  payload.signature_key = crypto.createHash("sha512")
    .update(payload.order_id + payload.status_code + payload.gross_amount + env.MIDTRANS_SERVER_KEY)
    .digest("hex");
  return payload;
}

const cases = [
  { name: "acknowledges a signed Sandbox probe without accessing invoices", probe: true, production: false, signature: "valid", expectedStatus: 200, expectedLookups: 0 },
  { name: "rejects a probe with an invalid signature before accessing invoices", probe: true, production: false, signature: "invalid", expectedStatus: 401, expectedLookups: 0 },
  { name: "rejects a probe without a signature", probe: true, production: false, signature: "missing", expectedStatus: 401, expectedLookups: 0 },
  { name: "does not acknowledge test prefixes specially in Production", probe: true, production: true, signature: "valid", expectedStatus: 404, expectedLookups: 1 },
  { name: "preserves invoice lookup for ordinary Sandbox notifications", probe: false, production: false, signature: "valid", expectedStatus: 404, expectedLookups: 1 }
];

for (const scenario of cases) {
  test(scenario.name, async () => {
    const originalLookup = prisma.invoice.findUnique;
    const originalProduction = env.MIDTRANS_IS_PRODUCTION;
    const payload = signedPayload(scenario.probe ? "payment_notif_test_unit" : "CLINIC-unit");
    if (scenario.signature === "invalid") payload.signature_key = "invalid";
    if (scenario.signature === "missing") delete payload.signature_key;
    let lookups = 0;
    let status;
    let response;
    prisma.invoice.findUnique = async (args) => {
      lookups += 1;
      assert.equal(args.where.midtransOrderId, payload.order_id);
      return null;
    };
    env.MIDTRANS_IS_PRODUCTION = scenario.production;

    try {
      await handleMidtransNotification(
        { body: payload },
        { json(body) { status = 200; response = body; } },
        (error) => { status = error.statusCode; }
      );
      assert.equal(status, scenario.expectedStatus);
      assert.equal(lookups, scenario.expectedLookups);
      if (status === 200) assert.deepEqual(response, { message: "Sandbox notification test received" });
    } finally {
      prisma.invoice.findUnique = originalLookup;
      env.MIDTRANS_IS_PRODUCTION = originalProduction;
    }
  });
}
