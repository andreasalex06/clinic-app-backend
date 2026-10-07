const assert = require('node:assert/strict');
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = 'test-secret-not-for-production';
process.env.MIDTRANS_SERVER_KEY = 'test-server';
process.env.MIDTRANS_CLIENT_KEY = 'test-client';
const jwt = require('jsonwebtoken');
const midtrans = require('midtrans-client');
const { prisma } = require('../dist/src/config/prisma');
const { createMidtransPayment } = require('../dist/src/modules/public/public.controller');
let invoice;
let calls = 0;
let failure;
prisma.patient.findUnique = async () => ({ id: 'patient' });
prisma.invoice.findUnique = async () => invoice;
prisma.invoice.update = async () => invoice;
midtrans.Snap.prototype.createTransaction = async () => {
  calls++;
  if (failure) throw failure;
  return { token: 'new-token', redirect_url: 'https://example.test/pay' };
};
const token = jwt.sign({ patientId: 'patient', scope: 'PATIENT' }, process.env.JWT_SECRET);
async function invoke() {
  let body;
  let error;
  await createMidtransPayment(
    { headers: { authorization: `Bearer ${token}` }, params: { invoiceId: 'invoice' } },
    { json: value => { body = value; } },
    value => { error = value; }
  );
  return { body, error };
}
async function run() {
  invoice = { id: 'invoice', invoiceNo: 'INV-1', status: 'UNPAID', total: 100, items: [],
    visit: { patientId: 'patient', patient: { name: 'Test', phone: '000' } },
    midtransToken: 'saved-token', midtransRedirectUrl: 'https://example.test/saved' };
  assert.equal((await invoke()).body.data.token, 'saved-token');
  assert.equal(calls, 0);
  invoice.midtransTransactionStatus = 'expire';
  assert.equal((await invoke()).error.statusCode, 409);
  assert.equal(calls, 0);
  invoice.midtransTransactionStatus = null;
  invoice.midtransToken = null;
  invoice.midtransRedirectUrl = null;
  failure = { ApiResponse: { error_messages: ['transaction_details.order_id sudah digunakan'] } };
  assert.equal((await invoke()).error.statusCode, 409);
  failure = { secret: 'must-not-leak' };
  const failed = await invoke();
  assert.equal(failed.error.statusCode, 502);
  assert.ok(!failed.error.message.includes('must-not-leak'));
  failure = null;
  assert.equal((await invoke()).body.data.token, 'new-token');
  invoice.visit.patientId = 'other';
  assert.equal((await invoke()).error.statusCode, 404);
  console.log('Passed: reuse, expired, duplicate, upstream failure, creation, ownership');
}
run().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
