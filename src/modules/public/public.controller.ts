import { NextFunction, Request, Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt, { SignOptions } from "jsonwebtoken";
import midtransClient from "midtrans-client";
import { InvoiceStatus, PharmacyStatus } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import { AppError } from "../../utils/AppError";
import { generateVisitNumber } from "../../utils/visit-number";
import { emitPharmacyChanged } from "../../socket";

type PatientTokenPayload = {
  patientId: string;
  phone: string;
  scope: "PATIENT";
};

function normalizePatientName(name: string) {
  return name.toUpperCase();
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function signPatientToken(patient: { id: string; phone: string }) {
  const payload: PatientTokenPayload = {
    patientId: patient.id,
    phone: patient.phone,
    scope: "PATIENT"
  };
  const signOptions: SignOptions = { expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"] };

  return jwt.sign(payload, env.JWT_SECRET, signOptions);
}

function getMidtransSnap() {
  if (!env.MIDTRANS_SERVER_KEY || !env.MIDTRANS_CLIENT_KEY) {
    throw new AppError("Konfigurasi Midtrans sandbox belum tersedia", 500);
  }

  return new midtransClient.Snap({
    isProduction: env.MIDTRANS_IS_PRODUCTION,
    serverKey: env.MIDTRANS_SERVER_KEY,
    clientKey: env.MIDTRANS_CLIENT_KEY
  });
}

function createMidtransOrderId(invoiceNo: string) {
  return `CLINIC-${invoiceNo}`.replace(/[^a-zA-Z0-9-_]/g, "-");
}

function verifyMidtransSignature(payload: {
  order_id?: string;
  status_code?: string;
  gross_amount?: string;
  signature_key?: string;
}) {
  if (!payload.order_id || !payload.status_code || !payload.gross_amount || !payload.signature_key) {
    return false;
  }

  const signatureSource =
    payload.order_id +
    payload.status_code +
    payload.gross_amount +
    env.MIDTRANS_SERVER_KEY;
  const signature = crypto
    .createHash("sha512")
    .update(signatureSource)
    .digest("hex");

  return signature === payload.signature_key;
}

const publicPatientSelect = {
  id: true,
  name: true,
  phone: true,
  gender: true,
  birthDate: true,
  address: true
};

function getPatientTokenPayload(req: Request) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    throw new AppError("Patient authentication token is required", 401);
  }

  const token = authHeader.split(" ")[1];
  const decoded = jwt.verify(token, env.JWT_SECRET) as PatientTokenPayload;

  if (decoded.scope !== "PATIENT" || !decoded.patientId) {
    throw new AppError("Invalid patient token", 401);
  }

  return decoded;
}

async function getAuthenticatedPatientToken(req: Request) {
  const patientToken = getPatientTokenPayload(req);
  const patient = await prisma.patient.findUnique({
    where: { id: patientToken.patientId },
    select: { id: true }
  });

  if (!patient) {
    throw new AppError("Sesi pasien tidak valid, silakan login ulang", 401);
  }

  return patientToken;
}

export async function registerPatient(req: Request, res: Response, next: NextFunction) {
  try {
    const existingPatient = await prisma.patient.findFirst({
      where: { phone: req.body.phone }
    });

    if (existingPatient?.password) {
      throw new AppError("Nomor WhatsApp sudah terdaftar, silakan login", 409);
    }

    const password = await bcrypt.hash(req.body.password, 10);
    const patientData = {
      name: normalizePatientName(req.body.name),
      phone: req.body.phone,
      password,
      gender: req.body.gender,
      birthDate: req.body.birthDate,
      address: req.body.address
    };
    const patient = existingPatient
      ? await prisma.patient.update({
          where: { id: existingPatient.id },
          data: patientData,
          select: publicPatientSelect
        })
      : await prisma.patient.create({
          data: patientData,
          select: publicPatientSelect
        });

    res.status(201).json({
      data: {
        token: signPatientToken(patient),
        patient
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function loginPatient(req: Request, res: Response, next: NextFunction) {
  try {
    const patient = await prisma.patient.findFirst({
      where: { phone: req.body.phone }
    });

    if (!patient?.password) {
      throw new AppError("Nomor WhatsApp atau password salah", 401);
    }

    const isPasswordValid = await bcrypt.compare(req.body.password, patient.password);

    if (!isPasswordValid) {
      throw new AppError("Nomor WhatsApp atau password salah", 401);
    }

    res.json({
      data: {
        token: signPatientToken(patient),
        patient: {
          id: patient.id,
          name: patient.name,
          phone: patient.phone,
          gender: patient.gender,
          birthDate: patient.birthDate,
          address: patient.address
        }
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function getPublicDoctors(_req: Request, res: Response, next: NextFunction) {
  try {
    const doctors = await prisma.doctor.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" }
    });

    res.json({ data: doctors });
  } catch (error) {
    next(error);
  }
}

export async function checkInPatient(req: Request, res: Response, next: NextFunction) {
  try {
    const patientToken = await getAuthenticatedPatientToken(req);
    const doctor = await prisma.doctor.findUnique({
      where: { id: req.body.doctorId }
    });

    if (!doctor) {
      throw new AppError("Doctor not found", 404);
    }

    if (!doctor.isActive) {
      throw new AppError("Dokter sedang nonaktif, silakan pilih dokter lain", 400);
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
          patientId: patientToken.patientId,
          doctorId: req.body.doctorId
        },
        include: {
          patient: { select: publicPatientSelect },
          doctor: true
        }
      });
    });

    res.status(201).json({ data: visit });
  } catch (error) {
    next(error);
  }
}

export async function getPatientQueueStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const patientToken = await getAuthenticatedPatientToken(req);
    const visit = await prisma.visit.findUnique({
      where: { id: req.params.visitId as string },
      include: {
        patient: { select: publicPatientSelect },
        doctor: true,
        invoice: true,
        pharmacyOrder: true
      }
    });

    if (!visit || visit.patientId !== patientToken.patientId) {
      throw new AppError("Visit not found", 404);
    }

    const waitingAhead = await prisma.visit.count({
      where: {
        queueDate: visit.queueDate,
        status: "WAITING",
        queueNumber: { lt: visit.queueNumber }
      }
    });

    res.json({
      data: {
        ...visit,
        waitingAhead
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function getActivePatientQueue(req: Request, res: Response, next: NextFunction) {
  try {
    const patientToken = await getAuthenticatedPatientToken(req);
    const today = startOfDay(new Date());

    await prisma.visit.updateMany({
      where: {
        patientId: patientToken.patientId,
        queueDate: { lt: today },
        status: { in: ["WAITING", "IN_CONSULTATION"] }
      },
      data: { status: "CANCELLED" }
    });

    const visit = await prisma.visit.findFirst({
      where: {
        patientId: patientToken.patientId,
        queueDate: today,
        status: { in: ["WAITING", "IN_CONSULTATION"] }
      },
      include: {
        patient: { select: publicPatientSelect },
        doctor: true,
        invoice: true,
        pharmacyOrder: true
      },
      orderBy: { checkInTime: "desc" }
    });

    if (!visit) {
      return res.json({ data: null });
    }

    const waitingAhead = await prisma.visit.count({
      where: {
        queueDate: visit.queueDate,
        status: "WAITING",
        queueNumber: { lt: visit.queueNumber }
      }
    });

    res.json({
      data: {
        ...visit,
        waitingAhead
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function getPatientHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const patientToken = await getAuthenticatedPatientToken(req);
    const visits = await prisma.visit.findMany({
      where: { patientId: patientToken.patientId },
      include: {
        patient: { select: publicPatientSelect },
        doctor: true,
        consultation: {
          include: {
            diagnosis: true,
            treatments: { include: { treatment: true } },
            medicines: { include: { medicine: true } }
          }
        },
        invoice: true,
        pharmacyOrder: true
      },
      orderBy: { checkInTime: "desc" }
    });

    res.json({ data: visits });
  } catch (error) {
    next(error);
  }
}

export async function getActivePatientPharmacy(req: Request, res: Response, next: NextFunction) {
  try {
    const patientToken = await getAuthenticatedPatientToken(req);
    const order = await prisma.pharmacyOrder.findFirst({
      where: {
        status: {
          in: [
            PharmacyStatus.WAITING_PAYMENT,
            PharmacyStatus.PREPARING,
            PharmacyStatus.READY_FOR_PICKUP
          ]
        },
        visit: {
          patientId: patientToken.patientId
        }
      },
      include: {
        visit: {
          include: {
            patient: { select: publicPatientSelect },
            doctor: true,
            invoice: true,
            consultation: {
              include: {
                medicines: { include: { medicine: true } }
              }
            }
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    res.json({ data: order });
  } catch (error) {
    next(error);
  }
}

export async function createMidtransPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const patientToken = await getAuthenticatedPatientToken(req);
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.invoiceId as string },
      include: {
        items: true,
        visit: {
          include: {
            patient: { select: publicPatientSelect },
            doctor: true
          }
        }
      }
    });

    if (!invoice || invoice.visit.patientId !== patientToken.patientId) {
      throw new AppError("Invoice not found", 404);
    }

    if (invoice.status === InvoiceStatus.PAID) {
      throw new AppError("Invoice sudah lunas", 400);
    }

    const snap = getMidtransSnap();
    const orderId = invoice.midtransOrderId ?? createMidtransOrderId(invoice.invoiceNo);
    const transaction = await snap.createTransaction({
      transaction_details: {
        order_id: orderId,
        gross_amount: invoice.total
      },
      customer_details: {
        first_name: invoice.visit.patient.name,
        phone: invoice.visit.patient.phone
      },
      item_details: invoice.items.map((item) => ({
        id: item.id,
        name: item.item,
        price: item.price,
        quantity: item.quantity
      })),
      callbacks: {
        finish: `${env.USER_FRONTEND_URL}/history`
      }
    });

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        midtransOrderId: orderId,
        midtransToken: transaction.token,
        midtransRedirectUrl: transaction.redirect_url
      }
    });

    res.json({
      data: {
        token: transaction.token,
        redirectUrl: transaction.redirect_url,
        clientKey: env.MIDTRANS_CLIENT_KEY
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function handleMidtransNotification(req: Request, res: Response, next: NextFunction) {
  try {
    if (!env.MIDTRANS_SERVER_KEY) {
      throw new AppError("Konfigurasi Midtrans sandbox belum tersedia", 500);
    }

    const payload = req.body as {
      order_id?: string;
      status_code?: string;
      gross_amount?: string;
      signature_key?: string;
      transaction_status?: string;
      payment_type?: string;
    };

    if (!verifyMidtransSignature(payload)) {
      throw new AppError("Invalid Midtrans signature", 401);
    }

    // Dashboard Sandbox probes do not correspond to clinic invoices.
    if (!env.MIDTRANS_IS_PRODUCTION && payload.order_id?.startsWith("payment_notif_test_")) {
      res.json({ message: "Sandbox notification test received" });
      return;
    }

    const invoice = await prisma.invoice.findUnique({
      where: { midtransOrderId: payload.order_id },
      include: {
        visit: {
          include: {
            pharmacyOrder: true
          }
        }
      }
    });

    if (!invoice) {
      throw new AppError("Invoice not found", 404);
    }

    const paidStatuses = ["settlement", "capture"];
    const failedStatuses = ["deny", "cancel", "expire", "failure"];

    if (payload.transaction_status && paidStatuses.includes(payload.transaction_status)) {
      const updatedInvoice = await prisma.$transaction(async (tx) => {
        const paidInvoice = await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            status: InvoiceStatus.PAID,
            paidAt: new Date(),
            midtransTransactionStatus: payload.transaction_status,
            midtransPaymentType: payload.payment_type
          },
          include: {
            visit: {
              include: {
                pharmacyOrder: true
              }
            }
          }
        });

        if (paidInvoice.visit.pharmacyOrder?.status === PharmacyStatus.WAITING_PAYMENT) {
          const queueDate = startOfDay(new Date());
          const latestOrder = await tx.pharmacyOrder.findFirst({
            where: { queueDate },
            orderBy: { queueNumber: "desc" },
            select: { queueNumber: true }
          });

          await tx.pharmacyOrder.update({
            where: { id: paidInvoice.visit.pharmacyOrder.id },
            data: {
              status: PharmacyStatus.PREPARING,
              queueDate,
              queueNumber: (latestOrder?.queueNumber ?? 0) + 1,
              preparedAt: new Date()
            }
          });
        }

        return paidInvoice;
      });

      if (updatedInvoice.visit.pharmacyOrder) {
        emitPharmacyChanged({
          patientId: updatedInvoice.visit.patientId,
          visitId: updatedInvoice.visit.id,
          orderId: updatedInvoice.visit.pharmacyOrder.id,
          status: PharmacyStatus.PREPARING
        });
      }
    }

    if (payload.transaction_status && failedStatuses.includes(payload.transaction_status)) {
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          midtransTransactionStatus: payload.transaction_status,
          midtransPaymentType: payload.payment_type
        }
      });
    }

    res.json({ message: "OK" });
  } catch (error) {
    next(error);
  }
}
