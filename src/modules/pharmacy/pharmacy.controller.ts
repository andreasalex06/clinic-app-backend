import { NextFunction, Request, Response } from "express";
import { PharmacyStatus, Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/AppError";
import { emitPharmacyChanged } from "../../socket";

const pharmacyOrderInclude = {
  visit: {
    include: {
      patient: true,
      doctor: true,
      invoice: true,
      consultation: {
        include: {
          medicines: { include: { medicine: true } }
        }
      }
    }
  }
} as const;

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function emitOrderChanged(order: Prisma.PharmacyOrderGetPayload<{ include: typeof pharmacyOrderInclude }>) {
  emitPharmacyChanged({
    patientId: order.visit.patientId,
    visitId: order.visitId,
    orderId: order.id,
    status: order.status
  });
}

async function ensurePharmacyQueue(orderId: string) {
  const order = await prisma.pharmacyOrder.findUnique({
    where: { id: orderId },
    select: { queueNumber: true, queueDate: true }
  });

  if (!order) {
    throw new AppError("Pharmacy order not found", 404);
  }

  if (order.queueNumber && order.queueDate) {
    return {};
  }

  const queueDate = startOfDay(new Date());
  const latestOrder = await prisma.pharmacyOrder.findFirst({
    where: { queueDate },
    orderBy: { queueNumber: "desc" },
    select: { queueNumber: true }
  });

  return {
    queueDate,
    queueNumber: (latestOrder?.queueNumber ?? 0) + 1
  };
}

export async function getPharmacyOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);
    const skip = (page - 1) * limit;
    const where: Prisma.PharmacyOrderWhereInput = {
      status: req.query.status as PharmacyStatus | undefined
    };

    const [orders, total] = await Promise.all([
      prisma.pharmacyOrder.findMany({
        where,
        include: pharmacyOrderInclude,
        orderBy: [
          { queueDate: "desc" },
          { queueNumber: "asc" },
          { createdAt: "desc" }
        ],
        skip,
        take: limit
      }),
      prisma.pharmacyOrder.count({ where })
    ]);

    res.json({
      data: orders,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1)
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function preparePharmacyOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const order = await prisma.pharmacyOrder.update({
      where: { id: req.params.id as string },
      data: {
        ...(await ensurePharmacyQueue(req.params.id as string)),
        status: PharmacyStatus.PREPARING,
        preparedAt: new Date()
      },
      include: pharmacyOrderInclude
    });

    emitOrderChanged(order);

    res.json({ data: order });
  } catch (error) {
    next(error);
  }
}

export async function markPharmacyOrderReady(req: Request, res: Response, next: NextFunction) {
  try {
    const order = await prisma.pharmacyOrder.update({
      where: { id: req.params.id as string },
      data: {
        status: PharmacyStatus.READY_FOR_PICKUP,
        readyAt: new Date()
      },
      include: pharmacyOrderInclude
    });

    emitOrderChanged(order);

    res.json({ data: order });
  } catch (error) {
    next(error);
  }
}

export async function completePharmacyOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const order = await prisma.pharmacyOrder.update({
      where: { id: req.params.id as string },
      data: {
        status: PharmacyStatus.COMPLETED,
        pickedUpAt: new Date()
      },
      include: pharmacyOrderInclude
    });

    emitOrderChanged(order);

    res.json({ data: order });
  } catch (error) {
    next(error);
  }
}
