import { NextFunction, Request, Response } from "express";
import { InvoiceStatus, Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/AppError";

export async function getInvoices(req: Request, res: Response, next: NextFunction) {
  try {
    const status = req.query.status as InvoiceStatus | undefined;
    const search = String(req.query.search || "").trim();
    const where: Prisma.InvoiceWhereInput = {
      status,
      OR: search
        ? [
            { invoiceNo: { contains: search, mode: "insensitive" } },
            { visit: { visitNumber: { contains: search, mode: "insensitive" } } },
            { visit: { patient: { name: { contains: search, mode: "insensitive" } } } },
            { visit: { patient: { phone: { contains: search, mode: "insensitive" } } } },
            { visit: { doctor: { name: { contains: search, mode: "insensitive" } } } }
          ]
        : undefined
    };
    const include = {
      visit: {
        include: {
          patient: true,
          doctor: true
        }
      }
    } as const;

    if (req.query.page || req.query.limit) {
      const page = Math.max(Number(req.query.page) || 1, 1);
      const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);
      const skip = (page - 1) * limit;

      const [invoices, total, unpaidSummary] = await prisma.$transaction([
        prisma.invoice.findMany({
          where,
          include,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit
        }),
        prisma.invoice.count({ where }),
        prisma.invoice.aggregate({
          where: {
            ...where,
            status: InvoiceStatus.UNPAID
          },
          _sum: { total: true }
        })
      ]);

      return res.json({
        data: invoices,
        meta: {
          page,
          limit,
          total,
          totalPages: Math.max(Math.ceil(total / limit), 1)
        },
        summary: {
          totalInvoices: total,
          totalUnpaid: unpaidSummary._sum.total || 0
        }
      });
    }

    const [invoices, unpaidSummary] = await prisma.$transaction([
      prisma.invoice.findMany({
        where,
        include,
        orderBy: { createdAt: "desc" }
      }),
      prisma.invoice.aggregate({
        where: {
          ...where,
          status: InvoiceStatus.UNPAID
        },
        _sum: { total: true }
      })
    ]);

    res.json({
      data: invoices,
      summary: {
        totalInvoices: invoices.length,
        totalUnpaid: unpaidSummary._sum.total || 0
      }
    });
  } catch (error) {
    next(error);
  }
}

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
