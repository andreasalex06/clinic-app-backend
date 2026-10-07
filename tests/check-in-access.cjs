const assert = require('node:assert/strict');
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = 'test-secret-not-for-production';
const express = require('express');
const jwt = require('jsonwebtoken');
const { prisma } = require('../dist/src/config/prisma');
const { authRoutes } = require('../dist/src/modules/auth/auth.routes');
const { checkInPatient } = require('../dist/src/modules/public/public.controller');
const { createVisit } = require('../dist/src/modules/visits/visit.controller');
let lockCalls = 0;
const existing = { id: 'existing', queueNumber: 1 };
prisma.patient.findUnique = async () => ({ id: 'patient' });
prisma.doctor.findUnique = async () => ({ id: 'doctor', isActive: true });
prisma.visit.findUniqueOrThrow = async () => existing;
prisma.$transaction = async work => work({
  $queryRaw: async () => { lockCalls++; },
  visit: {
    findFirst: async args => {
      assert.equal(args.where.patientId, 'patient');
      assert.deepEqual(args.where.status.in, ['WAITING', 'IN_CONSULTATION']);
      assert.equal(lockCalls > 0, true);
      return existing;
    },
    create: async () => { throw new Error('Duplicate must not create a visit'); }
  }
});
async function run() {
  const app = express();
  app.use(express.json());
  app.use('/auth', authRoutes);
  app.use((err, req, res, next) => res.status(err.name === 'ZodError' ? 400 : err.statusCode || 500).json({ message: err.message }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}/auth/register`;
    assert.equal((await fetch(url, { method: 'POST' })).status, 401);
    for (const role of ['STAFF', 'DOCTOR']) {
      const token = jwt.sign({ id: 'user', role }, process.env.JWT_SECRET);
      assert.equal((await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })).status, 403);
    }
    const admin = jwt.sign({ id: 'admin', role: 'ADMIN' }, process.env.JWT_SECRET);
    assert.equal((await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${admin}`, 'Content-Type': 'application/json' }, body: '{}' })).status, 400);
    const patient = jwt.sign({ patientId: 'patient', scope: 'PATIENT' }, process.env.JWT_SECRET);
    for (const handler of [checkInPatient, createVisit]) {
      let status;
      let body;
      let error;
      const res = { status: value => { status = value; return res; }, json: value => { body = value; } };
      await handler({ headers: { authorization: `Bearer ${patient}` }, body: { doctorId: 'doctor', patientId: 'patient' } }, res, value => { error = value; });
      assert.equal(error, undefined);
      assert.equal(status, 200);
      assert.equal(body.data.id, 'existing');
    }
    assert.equal(lockCalls, 2);
    console.log('Passed: registration authorization and duplicate reuse on patient/staff check-in');
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
