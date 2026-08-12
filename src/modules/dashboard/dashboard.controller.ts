import { NextFunction, Request, Response } from "express";
import { InvoiceStatus, VisitStatus } from "@prisma/client";
import { prisma } from "../../config/prisma";

export async function getDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    const [todayVisits, waiting, inConsultation, completed, unpaidInvoices] = await Promise.all([
      prisma.visit.count({
        where: { checkInTime: { gte: startOfToday, lt: endOfToday } }
      }),
      prisma.visit.count({
        where: {
          status: VisitStatus.WAITING,
          checkInTime: { gte: startOfToday, lt: endOfToday }
        }
      }),
      prisma.visit.count({
        where: {
          status: VisitStatus.IN_CONSULTATION,
          checkInTime: { gte: startOfToday, lt: endOfToday }
        }
      }),
      prisma.visit.count({
        where: {
          status: VisitStatus.COMPLETED,
          checkInTime: { gte: startOfToday, lt: endOfToday }
        }
      }),
      prisma.invoice.count({
        where: {
          status: InvoiceStatus.UNPAID,
          createdAt: { gte: startOfToday, lt: endOfToday }
        }
      })
    ]);

    res.json({
      data: {
        todayVisits,
        waiting,
        inConsultation,
        completed,
        unpaidInvoices
      }
    });
  } catch (error) {
    next(error);
  }
}
