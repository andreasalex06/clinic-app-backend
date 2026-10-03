import { NextFunction, Request, Response } from "express";
import { Prisma, VisitStatus } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/AppError";
import { generateVisitNumber } from "../../utils/visit-number";
import { emitQueueChanged, emitQueueCreated } from "../../socket";

function sortVisitsByNewest<T extends { checkInTime: Date; queueDate: Date; queueNumber: number }>(visits: T[]) {
  return [...visits].sort((current, next) => {
    const checkInTimeOrder = next.checkInTime.getTime() - current.checkInTime.getTime();

    if (checkInTimeOrder !== 0) {
      return checkInTimeOrder;
    }

    const queueDateOrder = next.queueDate.getTime() - current.queueDate.getTime();

    if (queueDateOrder !== 0) {
      return queueDateOrder;
    }

    return next.queueNumber - current.queueNumber;
  });
}

type QueueAvailabilityVisit = {
  id: string;
  doctorId: string;
  queueDate: Date;
  queueNumber: number;
  status: VisitStatus;
};

function getQueueKey(visit: Pick<QueueAvailabilityVisit, "doctorId" | "queueDate">) {
  return `${visit.doctorId}:${visit.queueDate.toISOString()}`;
}

function addQueueStartAvailability<T extends QueueAvailabilityVisit>(
  visits: T[],
  activeVisits: QueueAvailabilityVisit[]
) {
  const firstActiveVisitByQueue = new Map<string, QueueAvailabilityVisit>();

  for (const activeVisit of activeVisits) {
    const key = getQueueKey(activeVisit);
    const firstActiveVisit = firstActiveVisitByQueue.get(key);

    if (!firstActiveVisit || activeVisit.queueNumber < firstActiveVisit.queueNumber) {
      firstActiveVisitByQueue.set(key, activeVisit);
    }
  }

  return visits.map((visit) => ({
    ...visit,
    canStart:
      visit.status === VisitStatus.WAITING &&
      firstActiveVisitByQueue.get(getQueueKey(visit))?.id === visit.id
  }));
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export async function getVisits(req: Request, res: Response, next: NextFunction) {
  try {
    const status = req.query.status as VisitStatus | undefined;
    const date = req.query.date;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const where: Prisma.VisitWhereInput = {
      status,
      checkInTime:
        date === "today"
          ? {
              gte: startOfToday,
              lt: endOfToday
            }
          : undefined
    };
    const include = {
      patient: true,
      doctor: true,
      consultation: true,
      invoice: true
    } as const;
    const activeQueueWhere: Prisma.VisitWhereInput = {
      ...where,
      status: { in: [VisitStatus.WAITING, VisitStatus.IN_CONSULTATION] }
    };

    if (req.query.page || req.query.limit) {
      const page = Math.max(Number(req.query.page) || 1, 1);
      const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);
      const skip = (page - 1) * limit;

      const visits = await prisma.visit.findMany({
        where,
        include
      });
      const total = await prisma.visit.count({ where });
      const activeVisits = await prisma.visit.findMany({
        where: activeQueueWhere,
        select: {
          id: true,
          doctorId: true,
          queueDate: true,
          queueNumber: true,
          status: true
        }
      });
      const sortedVisits = sortVisitsByNewest(
        addQueueStartAvailability(visits, activeVisits)
      ).slice(skip, skip + limit);

      return res.json({
        data: sortedVisits,
        meta: {
          page,
          limit,
          total,
          totalPages: Math.max(Math.ceil(total / limit), 1)
        }
      });
    }

    const visits = await prisma.visit.findMany({
      where,
      include
    });
    const activeVisits = await prisma.visit.findMany({
      where: activeQueueWhere,
      select: {
        id: true,
        doctorId: true,
        queueDate: true,
        queueNumber: true,
        status: true
      }
    });

    res.json({
      data: sortVisitsByNewest(addQueueStartAvailability(visits, activeVisits))
    });
  } catch (error) {
    next(error);
  }
}

export async function createVisit(req: Request, res: Response, next: NextFunction) {
  try {
    const patient = await prisma.patient.findUnique({
      where: { id: req.body.patientId }
    });

    if (!patient) {
      throw new AppError("Patient not found", 404);
    }

    const doctor = await prisma.doctor.findUnique({
      where: { id: req.body.doctorId }
    });

    if (!doctor) {
      throw new AppError("Doctor not found", 404);
    }

    const now = new Date();
    const queueDate = startOfDay(now);

    const createdVisit = await prisma.$transaction(async (tx) => {
      const latestVisit = await tx.visit.findFirst({
        where: {
          queueDate,
          doctorId: req.body.doctorId
        },
        orderBy: { queueNumber: "desc" },
        select: { queueNumber: true }
      });

      return tx.visit.create({
        data: {
          visitNumber: generateVisitNumber(),
          queueNumber: (latestVisit?.queueNumber ?? 0) + 1,
          queueDate,
          patientId: req.body.patientId,
          doctorId: req.body.doctorId
        }
      });
    });

    const visit = await prisma.visit.findUniqueOrThrow({
      where: { id: createdVisit.id },
      include: {
        patient: true,
        doctor: true
      }
    });

    emitQueueCreated({
      visitId: visit.id,
      patientName: visit.patient.name,
      doctorName: visit.doctor.name,
      queueNumber: visit.queueNumber,
      doctorQueueIndex: visit.doctor.queueIndex
    });

    emitQueueChanged({
      patientId: visit.patientId,
      visitId: visit.id,
      status: visit.status,
      doctorId: visit.doctorId,
      queueDate: visit.queueDate
    });

    res.status(201).json({ data: visit });
  } catch (error) {
    next(error);
  }
}

export async function updateVisitStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const today = startOfDay(new Date());
    const updatedVisit = await prisma.$transaction(async (tx) => {
      await tx.visit.updateMany({
        where: {
          queueDate: { lt: today },
          status: { in: [VisitStatus.WAITING, VisitStatus.IN_CONSULTATION] }
        },
        data: { status: VisitStatus.CANCELLED }
      });

      const currentVisit = await tx.visit.findUnique({
        where: { id: req.params.id as string },
        select: {
          id: true,
          queueDate: true,
          queueNumber: true,
          doctorId: true,
          status: true
        }
      });

      if (!currentVisit) {
        throw new AppError("Visit not found", 404);
      }

      if (
        req.body.status === VisitStatus.IN_CONSULTATION &&
        currentVisit.status === VisitStatus.WAITING
      ) {
        const earlierActiveVisit = await tx.visit.findFirst({
          where: {
            queueDate: currentVisit.queueDate,
            doctorId: currentVisit.doctorId,
            queueNumber: { lt: currentVisit.queueNumber },
            status: { in: [VisitStatus.WAITING, VisitStatus.IN_CONSULTATION] }
          },
          orderBy: { queueNumber: "asc" },
          select: { queueNumber: true }
        });

        if (earlierActiveVisit) {
          throw new AppError(
            `Antrean nomor ${earlierActiveVisit.queueNumber} harus diselesaikan atau dibatalkan terlebih dahulu`,
            409
          );
        }

        const activeConsultation = await tx.visit.findFirst({
          where: {
            id: { not: currentVisit.id },
            queueDate: currentVisit.queueDate,
            doctorId: currentVisit.doctorId,
            status: VisitStatus.IN_CONSULTATION
          },
          select: { id: true }
        });

        if (activeConsultation) {
          throw new AppError(
            "Masih ada sesi konsultasi aktif untuk dokter ini",
            409
          );
        }
      }

      return tx.visit.update({
        where: { id: currentVisit.id },
        data: {
          status: req.body.status,
          ...(req.body.status === VisitStatus.IN_CONSULTATION && currentVisit.status === VisitStatus.WAITING
            ? { consultationStartedAt: new Date() }
            : {})
        }
      });
    });

    const visit = await prisma.visit.findUniqueOrThrow({
      where: { id: updatedVisit.id },
      include: {
        patient: true,
        doctor: true
      }
    });

    emitQueueChanged({
      patientId: visit.patientId,
      visitId: visit.id,
      status: visit.status,
      doctorId: visit.doctorId,
      queueDate: visit.queueDate
    });

    res.json({ data: visit });
  } catch (error) {
    next(error);
  }
}
