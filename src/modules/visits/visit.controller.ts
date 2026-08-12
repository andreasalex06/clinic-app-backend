import { NextFunction, Request, Response } from "express";
import { Prisma, VisitStatus } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/AppError";
import { generateVisitNumber } from "../../utils/visit-number";

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
          include,
          orderBy: { checkInTime: "asc" },
          skip,
          take: limit
        }),
        prisma.visit.count({ where })
      ]);

      return res.json({
        data: visits,
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
      include,
      orderBy: { checkInTime: "asc" }
    });

    res.json({ data: visits });
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

    const visit = await prisma.visit.create({
      data: {
        visitNumber: generateVisitNumber(),
        patientId: req.body.patientId,
        doctorId: req.body.doctorId
      },
      include: {
        patient: true,
        doctor: true
      }
    });

    res.status(201).json({ data: visit });
  } catch (error) {
    next(error);
  }
}

export async function updateVisitStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const visit = await prisma.visit.update({
      where: { id: req.params.id as string },
      data: { status: req.body.status },
      include: {
        patient: true,
        doctor: true
      }
    });

    res.json({ data: visit });
  } catch (error) {
    next(error);
  }
}
