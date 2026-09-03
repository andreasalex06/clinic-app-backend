import { NextFunction, Request, Response } from "express";
import { Prisma, VisitStatus } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/AppError";
import { generateVisitNumber } from "../../utils/visit-number";
import { emitQueueChanged } from "../../socket";

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

    if (req.query.page || req.query.limit) {
      const page = Math.max(Number(req.query.page) || 1, 1);
      const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);
      const skip = (page - 1) * limit;

      const [visits, total] = await prisma.$transaction([
        prisma.visit.findMany({
          where,
          include
        }),
        prisma.visit.count({ where })
      ]);
      const sortedVisits = sortVisitsByNewest(visits).slice(skip, skip + limit);

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

    res.json({ data: sortVisitsByNewest(visits) });
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

    const visit = await prisma.$transaction(async (tx) => {
      const latestVisit = await tx.visit.findFirst({
        where: { queueDate },
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
        },
        include: {
          patient: true,
          doctor: true
        }
      });
    });

    res.status(201).json({ data: visit });
  } catch (error) {
    next(error);
  }
}

export async function updateVisitStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const today = startOfDay(new Date());
    const visit = await prisma.$transaction(async (tx) => {
      await tx.visit.updateMany({
        where: {
          queueDate: { lt: today },
          status: { in: [VisitStatus.WAITING, VisitStatus.IN_CONSULTATION] }
        },
        data: { status: VisitStatus.CANCELLED }
      });

      const currentVisit = await tx.visit.findUnique({
        where: { id: req.params.id as string },
        select: { id: true, queueDate: true, queueNumber: true }
      });

      if (!currentVisit) {
        throw new AppError("Visit not found", 404);
      }

      if (req.body.status === VisitStatus.IN_CONSULTATION) {
        await tx.visit.updateMany({
          where: {
            queueDate: currentVisit.queueDate,
            queueNumber: { lt: currentVisit.queueNumber },
            status: { in: [VisitStatus.WAITING, VisitStatus.IN_CONSULTATION] }
          },
          data: { status: VisitStatus.CANCELLED }
        });
      }

      return tx.visit.update({
        where: { id: currentVisit.id },
        data: { status: req.body.status },
        include: {
          patient: true,
          doctor: true
        }
      });
    });

    emitQueueChanged({ visitId: visit.id, status: visit.status });

    res.json({ data: visit });
  } catch (error) {
    next(error);
  }
}
