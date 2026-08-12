import { NextFunction, Request, Response } from "express";
import { InvoiceStatus } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/AppError";

export async function getInvoiceByVisit(req: Request, res: Response, next: NextFunction) {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { visitId: req.params.visitId as string },
      include: {
        items: true,
        visit: {
          include: {
            patient: true,
            doctor: true
          }
        }
      }
    });

    if (!invoice) {
      throw new AppError("Invoice not found", 404);
    }

    res.json({ data: invoice });
  } catch (error) {
    next(error);
  }
}

export async function payInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const invoice = await prisma.invoice.update({
      where: { id: req.params.id as string },
      data: {
        status: InvoiceStatus.PAID,
        paidAt: new Date()
      },
      include: {
        items: true,
        visit: {
          include: {
            patient: true,
            doctor: true
          }
        }
      }
    });

    res.json({ data: invoice });
  } catch (error) {
    next(error);
  }
}
