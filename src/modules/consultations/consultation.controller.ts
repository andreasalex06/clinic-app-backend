import { NextFunction, Request, Response } from "express";
import { VisitStatus } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/AppError";
import { generateInvoiceNumber } from "../../utils/visit-number";

export async function createConsultation(req: Request, res: Response, next: NextFunction) {
  try {
    const visit = await prisma.visit.findUnique({
      where: { id: req.body.visitId },
      include: { consultation: true }
    });

    if (!visit) {
      throw new AppError("Visit not found", 404);
    }

    if (visit.consultation) {
      throw new AppError("Consultation already exists for this visit", 409);
    }

    const treatmentIds = [...new Set(req.body.treatmentIds as string[])];
    const treatments = await prisma.treatment.findMany({
      where: { id: { in: treatmentIds } }
    });

    if (treatments.length !== treatmentIds.length) {
      throw new AppError("One or more treatments were not found", 404);
    }

    const medicineIds = req.body.medicines.map((item: { medicineId: string }) => item.medicineId);
    const medicines = await prisma.medicine.findMany({
      where: { id: { in: medicineIds } }
    });

    if (medicines.length !== medicineIds.length) {
      throw new AppError("One or more medicines were not found", 404);
    }

    for (const item of req.body.medicines) {
      const medicine = medicines.find((entry) => entry.id === item.medicineId);
      if (!medicine || medicine.stock < item.quantity) {
        throw new AppError(`Insufficient stock for medicine ${medicine?.name ?? item.medicineId}`, 400);
      }
    }

    const consultation = await prisma.$transaction(async (tx) => {
      const createdConsultation = await tx.consultation.create({
        data: {
          visitId: req.body.visitId,
          complaint: req.body.complaint,
          diagnosisId: req.body.diagnosisId,
          notes: req.body.notes,
          treatments: {
            create: treatments.map((treatment) => ({
              treatmentId: treatment.id,
              price: treatment.price
            }))
          },
          medicines: {
            create: req.body.medicines.map((item: { medicineId: string; quantity: number }) => {
              const medicine = medicines.find((entry) => entry.id === item.medicineId);

              return {
                medicineId: item.medicineId,
                quantity: item.quantity,
                price: medicine?.price ?? 0
              };
            })
          }
        }
      });

      for (const item of req.body.medicines) {
        await tx.medicine.update({
          where: { id: item.medicineId },
          data: { stock: { decrement: item.quantity } }
        });
      }

      await tx.visit.update({
        where: { id: req.body.visitId },
        data: { status: VisitStatus.COMPLETED }
      });

      const invoiceItems = [
        ...treatments.map((treatment) => ({
          item: treatment.name,
          quantity: 1,
          price: treatment.price,
          amount: treatment.price
        })),
        ...req.body.medicines.map((item: { medicineId: string; quantity: number }) => {
          const medicine = medicines.find((entry) => entry.id === item.medicineId);
          const price = medicine?.price ?? 0;

          return {
            item: medicine?.name ?? "Medicine",
            quantity: item.quantity,
            price,
            amount: price * item.quantity
          };
        })
      ];

      const total = invoiceItems.reduce((sum, item) => sum + item.amount, 0);

      await tx.invoice.create({
        data: {
          invoiceNo: generateInvoiceNumber(),
          visitId: req.body.visitId,
          total,
          items: {
            create: invoiceItems
          }
        }
      });

      return tx.consultation.findUnique({
        where: { id: createdConsultation.id },
        include: {
          diagnosis: true,
          treatments: { include: { treatment: true } },
          medicines: { include: { medicine: true } },
          visit: {
            include: {
              patient: true,
              doctor: true,
              invoice: { include: { items: true } }
            }
          }
        }
      });
    });

    res.status(201).json({ data: consultation });
  } catch (error) {
    next(error);
  }
}

export async function getConsultationByVisit(req: Request, res: Response, next: NextFunction) {
  try {
    const consultation = await prisma.consultation.findUnique({
      where: { visitId: req.params.visitId as string },
      include: {
        diagnosis: true,
        treatments: { include: { treatment: true } },
        medicines: { include: { medicine: true } },
        visit: {
          include: {
            patient: true,
            doctor: true,
            invoice: { include: { items: true } }
          }
        }
      }
    });

    if (!consultation) {
      throw new AppError("Consultation not found", 404);
    }

    res.json({ data: consultation });
  } catch (error) {
    next(error);
  }
}
