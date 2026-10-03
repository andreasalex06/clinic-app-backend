import { Server } from "http";
import jwt from "jsonwebtoken";
import { Server as SocketServer } from "socket.io";
import { env } from "./config/env";
import { prisma } from "./config/prisma";

type PatientTokenPayload = {
  patientId: string;
  phone: string;
  scope: "PATIENT";
};

type DashboardTokenPayload = {
  id: string;
  email: string;
  role: "ADMIN" | "STAFF" | "DOCTOR";
};

let io: SocketServer | null = null;
const DASHBOARD_ROOM = "dashboard";

function getPatientRoom(patientId: string) {
  return `patient:${patientId}`;
}

export function registerSocketServer(server: Server) {
  io = new SocketServer(server, {
    cors: {
      origin: [env.FRONTEND_URL, env.USER_FRONTEND_URL],
      credentials: true
    }
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (typeof token !== "string" || !token) {
        return next(new Error("Patient authentication token is required"));
      }

      const decoded = jwt.verify(token, env.JWT_SECRET) as PatientTokenPayload | DashboardTokenPayload;

      if ("scope" in decoded && decoded.scope === "PATIENT" && decoded.patientId) {
        const patient = await prisma.patient.findUnique({
          where: { id: decoded.patientId },
          select: { id: true }
        });

        if (!patient) {
          return next(new Error("Sesi pasien tidak valid, silakan login ulang"));
        }

        socket.join(getPatientRoom(decoded.patientId));
        return next();
      }

      if ("id" in decoded && decoded.id && decoded.role) {
        const user = await prisma.user.findUnique({
          where: { id: decoded.id },
          select: { id: true, role: true }
        });

        if (!user || user.role !== decoded.role) {
          return next(new Error("Sesi dashboard tidak valid, silakan login ulang"));
        }

        socket.join(DASHBOARD_ROOM);
        return next();
      }

      return next(new Error("Invalid socket token"));
    } catch (error) {
      next(error instanceof Error ? error : new Error("Socket authentication failed"));
    }
  });

  return io;
}

export function emitQueueCreated(payload: {
  visitId: string;
  patientName: string;
  doctorName: string;
  queueNumber: number;
  doctorQueueIndex: number;
}) {
  io?.to(DASHBOARD_ROOM).emit("queue:created", payload);
}

export function emitQueueChanged(payload: {
  patientId: string;
  visitId: string;
  status?: string;
  doctorId: string;
  queueDate: Date;
}) {
  if (!io) return;

  const event = { visitId: payload.visitId, status: payload.status };

  io.to(DASHBOARD_ROOM).emit("queue:changed", event);
  io.to(getPatientRoom(payload.patientId)).emit("queue:changed", event);

  void prisma.visit.findMany({
    where: {
      doctorId: payload.doctorId,
      queueDate: payload.queueDate,
      status: { in: ["WAITING", "IN_CONSULTATION"] },
      patientId: { not: payload.patientId }
    },
    select: { patientId: true },
    distinct: ["patientId"]
  }).then((visits) => {
    const patientRooms = visits.map((visit) => getPatientRoom(visit.patientId));
    if (patientRooms.length > 0) {
      io?.to(patientRooms).emit("queue:changed", event);
    }
  }).catch((error: unknown) => {
    console.error("Failed to notify patients in the same queue", error);
  });
}

export function emitPharmacyChanged(payload: {
  patientId: string;
  visitId: string;
  orderId: string;
  status: string;
}) {
  const event = {
    visitId: payload.visitId,
    orderId: payload.orderId,
    status: payload.status
  };

  io?.to(DASHBOARD_ROOM).emit("pharmacy:changed", event);
  io?.to(getPatientRoom(payload.patientId)).emit("pharmacy:changed", event);
}
