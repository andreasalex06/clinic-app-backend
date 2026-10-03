import { Gender, PrismaClient, VisitStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import "dotenv/config";

if (process.env.NODE_ENV === "production" || process.env.ENABLE_QUEUE_ESTIMATE_SEED !== "1") {
  throw new Error("Set ENABLE_QUEUE_ESTIMATE_SEED=1 to run this development-only seed.");
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
const testPatientPhone = "089900009998";
const aheadPatientPhone = "089900009997";
const patientsAheadCount = 17;
const durations = [10, 12, 15, 18, 20];

function startOfDayDaysAgo(daysAgo: number) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(0, 0, 0, 0);
  return date;
}

async function ensureTestPatient(phone: string, name: string, password?: string) {
  const existing = await prisma.patient.findUnique({ where: { phone } });
  if (existing && existing.name !== name) {
    throw new Error(`Phone ${phone} already belongs to a non-test patient; refusing to modify it.`);
  }

  return prisma.patient.upsert({
    where: { phone },
    create: {
      name,
      phone,
      password,
      gender: Gender.FEMALE,
      birthDate: new Date("1995-05-15T00:00:00.000Z"),
      address: "Data uji estimasi antrean"
    },
    update: password ? { password } : { name }
  });
}

async function main() {
  const doctor = await prisma.doctor.findFirst({
    where: { isActive: true },
    orderBy: { queueIndex: "asc" }
  });
  const diagnosis = await prisma.diagnosis.findFirst({ orderBy: { code: "asc" } });

  if (!doctor || !diagnosis) {
    throw new Error("Seed master dokter dan diagnosis terlebih dahulu.");
  }

  const password = await bcrypt.hash("patient123", 10);
  const patient = await ensureTestPatient(testPatientPhone, "PASIEN ESTIMASI UJI", password);
  const queuePatients = await Promise.all(
    Array.from({ length: patientsAheadCount }, (_, index) => {
      const sequence = index + 1;
      const phone = sequence === 1
        ? aheadPatientPhone
        : `08990001${String(sequence).padStart(3, "0")}`;
      const name = sequence === 1
        ? "PASIEN ANTREAN UJI"
        : `PASIEN ANTREAN UJI ${String(sequence).padStart(2, "0")}`;
      return ensureTestPatient(phone, name);
    })
  );

  for (const [index, durationMinutes] of durations.entries()) {
    const queueDate = startOfDayDaysAgo(index + 1);
    const visitNumber = `TEST-EST-DURATION-${index + 1}`;
    const existing = await prisma.visit.findUnique({ where: { visitNumber } });
    const latestVisit = await prisma.visit.findFirst({
      where: {
        doctorId: doctor.id,
        queueDate,
        ...(existing ? { id: { not: existing.id } } : {})
      },
      orderBy: { queueNumber: "desc" },
      select: { queueNumber: true }
    });
    const queueNumber = existing?.queueDate.getTime() === queueDate.getTime()
      ? existing.queueNumber
      : (latestVisit?.queueNumber ?? 0) + 1;
    const consultationStartedAt = new Date(queueDate);
    consultationStartedAt.setHours(9, 0, 0, 0);
    const consultationEndedAt = new Date(consultationStartedAt.getTime() + durationMinutes * 60_000);
    const visitData = {
      visitNumber,
      queueNumber,
      queueDate,
      checkInTime: new Date(consultationStartedAt.getTime() - 15 * 60_000),
      consultationStartedAt,
      consultationEndedAt,
      status: VisitStatus.COMPLETED,
      patientId: patient.id,
      doctorId: doctor.id
    };

    await prisma.visit.upsert({
      where: { visitNumber },
      create: {
        ...visitData,
        consultation: {
          create: {
            complaint: "Keluhan ringan untuk pengujian estimasi durasi.",
            diagnosisId: diagnosis.id
          }
        }
      },
      update: {
        ...visitData,
        consultation: {
          upsert: {
            create: {
              complaint: "Keluhan ringan untuk pengujian estimasi durasi.",
              diagnosisId: diagnosis.id
            },
            update: {
              complaint: "Keluhan ringan untuk pengujian estimasi durasi.",
              diagnosisId: diagnosis.id
            }
          }
        }
      }
    });
  }

  const today = startOfDayDaysAgo(0);
  const now = new Date();
  const queueFixtures = [
    ...queuePatients.map((queuePatient, index) => ({
      visitNumber: index === 0 ? "TEST-EST-AHEAD" : `TEST-EST-AHEAD-${String(index + 1).padStart(2, "0")}`,
      patientId: queuePatient.id,
      checkInTime: new Date(now.getTime() + index * 1000)
    })),
    {
      visitNumber: "TEST-EST-PATIENT",
      patientId: patient.id,
      checkInTime: new Date(now.getTime() + patientsAheadCount * 1000)
    }
  ];
  const queueFixtureNumbers = queueFixtures.map((fixture) => fixture.visitNumber);
  const existingQueueFixtures = await prisma.visit.findMany({
    where: { visitNumber: { in: queueFixtureNumbers } },
    select: { id: true, visitNumber: true }
  });
  const latestTodayVisit = await prisma.visit.findFirst({
    where: {
      doctorId: doctor.id,
      queueDate: today,
      ...(existingQueueFixtures.length > 0
        ? { id: { notIn: existingQueueFixtures.map((visit) => visit.id) } }
        : {})
    },
    orderBy: { queueNumber: "desc" },
    select: { queueNumber: true }
  });
  const firstQueueNumber = (latestTodayVisit?.queueNumber ?? 0) + 1;
  const temporaryQueueNumber = (latestTodayVisit?.queueNumber ?? 0) + 1000;

  await prisma.$transaction(async (tx) => {
    for (const [index, fixture] of existingQueueFixtures.entries()) {
      await tx.visit.update({
        where: { id: fixture.id },
        data: {
          queueDate: today,
          doctorId: doctor.id,
          queueNumber: temporaryQueueNumber + index
        }
      });
    }

    for (const [index, fixture] of queueFixtures.entries()) {
      await tx.visit.upsert({
        where: { visitNumber: fixture.visitNumber },
        create: {
          ...fixture,
          queueNumber: firstQueueNumber + index,
          queueDate: today,
          doctorId: doctor.id,
          status: VisitStatus.WAITING
        },
        update: {
          ...fixture,
          queueNumber: firstQueueNumber + index,
          queueDate: today,
          doctorId: doctor.id,
          status: VisitStatus.WAITING,
          consultationStartedAt: null,
          consultationEndedAt: null
        }
      });
    }
  });

  console.log("Queue estimate fixtures ready.");
  console.log(`Doctor: ${doctor.name}`);
  console.log(`Completed consultation durations: ${durations.join(", ")} minutes (average 15 minutes).`);
  console.log(`Patient login: ${testPatientPhone} / patient123`);
  console.log(`Today's test queue has ${patientsAheadCount} waiting patients ahead of the test account.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
