import { NextFunction, Request, Response } from "express";
import { InvoiceStatus } from "@prisma/client";
import { prisma } from "../../config/prisma";

type FinancePeriod = "daily" | "weekly" | "monthly";

type TrendBucket = {
  key: string;
  label: string;
  start: Date;
  end: Date;
};

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function formatShortDate(date: Date) {
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
}

function createTrendBuckets(period: FinancePeriod): TrendBucket[] {
  const now = new Date();
  const today = startOfDay(now);

  if (period === "weekly") {
    return Array.from({ length: 8 }, (_, index) => {
      const start = addDays(today, (index - 7) * 7);
      const end = addDays(start, 7);

      return {
        key: start.toISOString(),
        label: `${formatShortDate(start)} - ${formatShortDate(addDays(end, -1))}`,
        start,
        end
      };
    });
  }

  if (period === "monthly") {
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    return Array.from({ length: 6 }, (_, index) => {
      const start = addMonths(monthStart, index - 5);
      const end = addMonths(start, 1);

      return {
        key: start.toISOString(),
        label: start.toLocaleDateString("id-ID", { month: "short", year: "numeric" }),
        start,
        end
      };
    });
  }

  return Array.from({ length: 7 }, (_, index) => {
    const start = addDays(today, index - 6);
    const end = addDays(start, 1);

    return {
      key: start.toISOString(),
      label: formatShortDate(start),
      start,
      end
    };
  });
}

export async function getFinanceSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const period = (req.query.period as FinancePeriod | undefined) ?? "daily";
    const buckets = createTrendBuckets(period);
    const rangeStart = buckets[0].start;
    const rangeEnd = buckets[buckets.length - 1].end;

    const [
      totalRevenue,
      paidInvoices,
      unpaidInvoices,
      outstandingRevenue,
      recentInvoices,
      visits,
      paidTrendInvoices
    ] = await Promise.all([
      prisma.invoice.aggregate({
        where: { status: InvoiceStatus.PAID },
        _sum: { total: true }
      }),
      prisma.invoice.count({
        where: { status: InvoiceStatus.PAID }
      }),
      prisma.invoice.count({
        where: { status: InvoiceStatus.UNPAID }
      }),
      prisma.invoice.aggregate({
        where: { status: InvoiceStatus.UNPAID },
        _sum: { total: true }
      }),
      prisma.invoice.findMany({
        take: 8,
        orderBy: { createdAt: "desc" },
        include: {
          visit: {
            include: {
              patient: true,
              doctor: true
            }
          }
        }
      }),
      prisma.visit.findMany({
        where: { checkInTime: { gte: rangeStart, lt: rangeEnd } },
        select: { checkInTime: true }
      }),
      prisma.invoice.findMany({
        where: {
          status: InvoiceStatus.PAID,
          paidAt: { gte: rangeStart, lt: rangeEnd }
        },
        select: {
          total: true,
          paidAt: true
        }
      })
    ]);

    const trends = buckets.map((bucket) => {
      const patientCount = visits.filter((visit) => visit.checkInTime >= bucket.start && visit.checkInTime < bucket.end).length;
      const revenue = paidTrendInvoices
        .filter((invoice) => invoice.paidAt && invoice.paidAt >= bucket.start && invoice.paidAt < bucket.end)
        .reduce((sum, invoice) => sum + invoice.total, 0);

      return {
        key: bucket.key,
        label: bucket.label,
        patients: patientCount,
        revenue
      };
    });

    res.json({
      data: {
        summary: {
          totalRevenue: totalRevenue._sum.total ?? 0,
          paidInvoices,
          unpaidInvoices,
          outstandingRevenue: outstandingRevenue._sum.total ?? 0
        },
        trends,
        recentInvoices
      }
    });
  } catch (error) {
    next(error);
  }
}
