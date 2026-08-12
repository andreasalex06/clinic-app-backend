import { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/AppError";

function normalizePatientData<T extends { name?: string }>(data: T) {
  return {
    ...data,
    ...(typeof data.name === "string" ? { name: data.name.toUpperCase() } : {})
  };
}

export async function getPatients(req: Request, res: Response, next: NextFunction) {
  try {
    const search = String(req.query.search ?? "").trim();
    const where: Prisma.PatientWhereInput | undefined = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { phone: { contains: search, mode: "insensitive" } }
          ]
        }
      : undefined;

    if (req.query.page || req.query.limit) {
      const page = Math.max(Number(req.query.page) || 1, 1);
      const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);
      const skip = (page - 1) * limit;

      const [patients, total] = await prisma.$transaction([
        prisma.patient.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit
        }),
        prisma.patient.count({ where })
      ]);

      return res.json({
        data: patients,
        meta: {
          page,
          limit,
          total,
          totalPages: Math.max(Math.ceil(total / limit), 1)
        }
      });
    }

    const patients = await prisma.patient.findMany({
      where,
      orderBy: { createdAt: "desc" }
    });

    res.json({ data: patients });
  } catch (error) {
    next(error);
  }
}

export async function getPatientById(req: Request, res: Response, next: NextFunction) {
  try {
    const patient = await prisma.patient.findUnique({
      where: { id: req.params.id as string },
      include: {
        visits: {
          include: {
            doctor: true,
            consultation: {
              include: {
                diagnosis: true,
                treatments: { include: { treatment: true } },
                medicines: { include: { medicine: true } }
              }
            },
            invoice: true
          },
          orderBy: { checkInTime: "desc" }
        }
      }
    });

    if (!patient) {
      throw new AppError("Patient not found", 404);
    }

    res.json({ data: patient });
  } catch (error) {
    next(error);
  }
}

export async function createPatient(req: Request, res: Response, next: NextFunction) {
  try {
    const patient = await prisma.patient.create({
      data: normalizePatientData(req.body)
    });

    res.status(201).json({ data: patient });
  } catch (error) {
    next(error);
  }
}

export async function updatePatient(req: Request, res: Response, next: NextFunction) {
  try {
    const patient = await prisma.patient.update({
      where: { id: req.params.id as string },
      data: normalizePatientData(req.body)
    });

    res.json({ data: patient });
  } catch (error) {
    next(error);
  }
}

export async function deletePatient(req: Request, res: Response, next: NextFunction) {
  try {
    const patientId = req.params.id as string;

    await prisma.$transaction(async (tx) => {
      const patient = await tx.patient.findUnique({
        where: { id: patientId },
        select: { id: true }
      });

      if (!patient) {
        throw new AppError("Patient not found", 404);
      }

      const visits = await tx.visit.findMany({
        where: { patientId },
        select: { id: true }
      });
      const visitIds = visits.map((visit) => visit.id);

      if (visitIds.length > 0) {
        const consultations = await tx.consultation.findMany({
          where: { visitId: { in: visitIds } },
          select: { id: true }
        });
        const consultationIds = consultations.map((consultation) => consultation.id);

        const invoices = await tx.invoice.findMany({
          where: { visitId: { in: visitIds } },
          select: { id: true }
        });
        const invoiceIds = invoices.map((invoice) => invoice.id);

        if (consultationIds.length > 0) {
          await tx.consultationMedicine.deleteMany({
            where: { consultationId: { in: consultationIds } }
          });

          await tx.consultationTreatment.deleteMany({
            where: { consultationId: { in: consultationIds } }
          });
        }

        if (invoiceIds.length > 0) {
          await tx.invoiceItem.deleteMany({
            where: { invoiceId: { in: invoiceIds } }
          });
        }

        await tx.consultation.deleteMany({
          where: { visitId: { in: visitIds } }
        });

        await tx.invoice.deleteMany({
          where: { visitId: { in: visitIds } }
        });

        await tx.visit.deleteMany({
          where: { id: { in: visitIds } }
        });
      }

      await tx.patient.delete({
        where: { id: patientId }
      });
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
