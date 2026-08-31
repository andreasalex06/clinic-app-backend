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

let io: SocketServer | null = null;

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

      const decoded = jwt.verify(token, env.JWT_SECRET) as PatientTokenPayload;

      if (decoded.scope !== "PATIENT" || !decoded.patientId) {
        return next(new Error("Invalid patient token"));
      }

      const patient = await prisma.patient.findUnique({
        where: { id: decoded.patientId },
        select: { id: true }
      });

      if (!patient) {
        return next(new Error("Sesi pasien tidak valid, silakan login ulang"));
      }

      socket.join(getPatientRoom(decoded.patientId));
      next();
    } catch (error) {
      next(error instanceof Error ? error : new Error("Socket authentication failed"));
    }
  });

  return io;
}

export function emitQueueChanged(_payload: { visitId: string; status?: string }) {
  io?.emit("queue:changed");
}

export function emitPharmacyChanged(payload: {
  patientId: string;
  visitId: string;
  orderId: string;
  status: string;
}) {
  io?.to(getPatientRoom(payload.patientId)).emit("pharmacy:changed", {
    visitId: payload.visitId,
    orderId: payload.orderId,
    status: payload.status
  });
}
