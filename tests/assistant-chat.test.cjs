const assert = require("node:assert/strict");
const { test } = require("node:test");
process.env.DATABASE_URL = "postgresql://test:test@127.0.0.1:1/test";
process.env.JWT_SECRET = "assistant-unit-test-secret";
const { askOllama, assistantToolRuntime } = require("../src/modules/assistant/assistant.ollama.ts");
const { clinicKnowledge } = require("../src/modules/assistant/assistant.context.ts");
const snapshot = { patientAge: 32, context: { klinik: clinicKnowledge, pasien: { usiaTahun: 32 }, katalogSpesialisasiDokter: ["Spesialis Mata"] } };
const input = { message: "ngambil obat nanti gimana prosesnya", history: [{ role: "user", text: "mata saya perih" }, { role: "model", text: "Dokter mata tersedia." }], demoAcknowledged: true };

function mock(t, calls, result, answer) {
  const originalFetch = global.fetch;
  const originalExecute = assistantToolRuntime.execute;
  const requests = [];
  const executions = [];
  global.fetch = async (_, options) => {
    requests.push(JSON.parse(options.body));
    const modelReply = Array.isArray(answer) ? answer[requests.length - 2] : answer;
    return new Response(JSON.stringify({ message: { content: JSON.stringify(requests.length === 1 ? { calls } : modelReply) }, done_reason: "stop" }));
  };
  assistantToolRuntime.execute = async (...args) => {
    executions.push(args);
    return typeof result === "function" ? result(...args) : result;
  };
  t.after(() => { global.fetch = originalFetch; assistantToolRuntime.execute = originalExecute; });
  return { requests, executions };
}
const answer = (reply, doctorIds = [], additionalCalls = []) => ({ reply, doctorIds, urgent: false, additionalCalls });

test("empty personal records still reach synthesis with procedures and separate conversation turns", async (t) => {
  const expected = answer("Pantau obat di Beranda, lalu ambil di farmasi ketika siap.");
  const { requests, executions } = mock(t,
    [{ name: "get_my_visit_history", arguments: {} }],
    { content: JSON.stringify({ kunjungan: [], total: 0 }), doctors: [] }, expected);
  assert.deepEqual(await askOllama(input, snapshot, "patient-1"), { reply: expected.reply, urgent: false, doctors: [] });
  assert.equal(requests.length, 2);
  assert.deepEqual(executions[0][2], { patientId: "patient-1", patientAge: 32 });
  assert.match(requests[1].messages[0].content, /farmasi klinik/);
  assert.match(requests[1].messages[0].content, /"kunjungan":\[\]/);
  assert.equal(requests[1].messages.at(-1).content, input.message);
  assert.equal(requests[1].messages[1].content, "mata saya perih");
});

test("one tool never bypasses Ollama final answer", async (t) => {
  const expected = answer("Pembayaran Anda sudah dikonfirmasi.");
  const { requests } = mock(t, [{ name: "get_my_invoice_status", arguments: {} }],
    { content: JSON.stringify({ nomorInvoice: "INV-1", statusPembayaran: "lunas" }), doctors: [] }, expected);
  const result = await askOllama({ ...input, message: "tagihan saya?" }, snapshot, "patient-1");
  assert.equal(result.reply, expected.reply);
  assert.equal(requests.length, 2);
  assert.match(requests[1].messages[0].content, /"statusPembayaran":"lunas"/);
});

test("zero tool plan still uses application knowledge in final synthesis", async (t) => {
  const { requests, executions } = mock(t, [], null, answer("Anda boleh menunggu di rumah sampai sisa antrean mendekati 3."));
  await askOllama(input, snapshot, "patient-1");
  assert.equal(executions.length, 0);
  assert.equal(requests.length, 2);
  assert.match(requests[1].messages[0].content, /3 atau kurang/);
});

test("cards are selected by the final answer rather than all retrieved candidates", async (t) => {
  const doctors = [{ id: "eye", name: "Dr. Mata" }, { id: "other", name: "Dr. Lain" }];
  mock(t, [{ name: "list_doctors", arguments: {} }], { content: JSON.stringify(doctors), doctors }, answer("Dr. Mata tersedia.", ["eye"]));
  const result = await askOllama(input, snapshot, "patient-1");
  assert.deepEqual(result.doctors, [doctors[0]]);
});

test("unknown card IDs fail closed", async (t) => {
  mock(t, [], null, answer("Dokter tersedia.", ["fabricated"]));
  await assert.rejects(askOllama(input, snapshot, "patient-1"), /tidak sesuai data dokter/);
});

test("unknown tools are rejected before execution", async (t) => {
  const { executions } = mock(t, [{ name: "run_sql", arguments: {} }], null, answer("Tidak."));
  await assert.rejects(askOllama(input, snapshot, "patient-1"), /tidak diizinkan/);
  assert.equal(executions.length, 0);
});

test("malformed final output cannot become a canned response", async (t) => {
  mock(t, [], null, { reply: "" });
  await assert.rejects(askOllama(input, snapshot, "patient-1"), /Jawaban AI tidak valid/);
});

test("urgent model output suppresses consultation cards", async (t) => {
  mock(t, [{ name: "mark_urgent", arguments: {} }],
    { content: JSON.stringify({ arahan: "Segera ke IGD." }), doctors: [] },
    { reply: "Segera minta bantuan dan menuju IGD.", doctorIds: [], urgent: true, additionalCalls: [] });
  const result = await askOllama({ ...input, message: "sesak berat sekarang" }, snapshot, "patient-1");
  assert.equal(result.urgent, true);
  assert.deepEqual(result.doctors, []);
});

test("invalid patient override is rejected by the actual tool validator", async () => {
  const { executeAssistantTool } = require("../src/modules/assistant/assistant.tools.ts");
  const result = await executeAssistantTool("get_my_queue_status", { patientId: "another-patient" }, { patientId: "patient-1", patientAge: 32 });
  assert.match(result.content, /Argumen tool tidak valid/);
});

test("echoing the patient's question is not accepted as an answer", async (t) => {
  mock(t, [], null, answer(input.message));
  await assert.rejects(askOllama(input, snapshot, "patient-1"), /belum menjawab/);
});

test("multiple results all reach the model before it answers", async (t) => {
  const { requests, executions } = mock(t, [
    { name: "get_my_invoice_status", arguments: {} },
    { name: "get_my_pharmacy_status", arguments: {} }
  ], { content: JSON.stringify({ status: "tersedia" }), doctors: [] }, answer("Data telah tersedia."));
  await askOllama(input, snapshot, "patient-1");
  assert.equal(executions.length, 2);
  assert.match(requests[1].messages[0].content, /get_my_invoice_status/);
  assert.match(requests[1].messages[0].content, /get_my_pharmacy_status/);
});

test("presentation removes only the greeting, preserving the model explanation", async (t) => {
  mock(t, [], null, answer("Halo, setelah siap, ambil obat di farmasi."));
  const result = await askOllama(input, snapshot, "patient-1");
  assert.equal(result.reply, "setelah siap, ambil obat di farmasi.");
});

test("agent corrects an irrelevant first tool before answering the latest question", async (t) => {
  const { requests, executions } = mock(t,
    [{ name: "get_my_pharmacy_status", arguments: {} }],
    (name) => name === "get_my_latest_consultation"
      ? { content: JSON.stringify({ diagnosisTercatat: "Migrain", catatanDokter: "Istirahat cukup", resepTercatat: [] }), doctors: [] }
      : { content: JSON.stringify({ statusObat: "siap diambil" }), doctors: [] },
    [
      answer("", [], [{ name: "get_my_latest_consultation", arguments: {} }]),
      answer("Hasil konsultasi terakhir mencatat migrain dengan anjuran istirahat cukup.")
    ]);
  const result = await askOllama({ ...input, message: "cek hasil konsul terakhir saya" }, snapshot, "patient-1");
  assert.deepEqual(executions.map(([name]) => name), ["get_my_pharmacy_status", "get_my_latest_consultation"]);
  assert.equal(requests.length, 3);
  assert.match(result.reply, /migrain/);
  assert.doesNotMatch(result.reply, /siap diambil/);
});
