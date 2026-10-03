import { Router } from "express";
import { assistantChat, assistantChatSchema } from "../assistant/assistant.controller";
import { validate } from "../../middlewares/validate.middleware";
import {
  checkInPatient,
  createMidtransPayment,
  getActivePatientPharmacy,
  getActivePatientQueue,
  getPatientHistory,
  getPatientQueueStatus,
  getPublicDoctors,
  handleMidtransNotification,
  loginPatient,
  registerPatient
} from "./public.controller";
import {
  invoiceIdParamSchema,
  patientLoginSchema,
  patientRegisterSchema,
  publicCheckInSchema,
  visitIdParamSchema
} from "./public.validation";

export const publicRoutes = Router();

publicRoutes.post("/patients/register", validate({ body: patientRegisterSchema }), registerPatient);
publicRoutes.post("/patients/login", validate({ body: patientLoginSchema }), loginPatient);
publicRoutes.get("/doctors", getPublicDoctors);
publicRoutes.post("/assistant/chat", validate({ body: assistantChatSchema }), assistantChat);
publicRoutes.post("/check-in", validate({ body: publicCheckInSchema }), checkInPatient);
publicRoutes.get("/queue/active", getActivePatientQueue);
publicRoutes.get("/queue/:visitId", validate({ params: visitIdParamSchema }), getPatientQueueStatus);
publicRoutes.get("/pharmacy/active", getActivePatientPharmacy);
publicRoutes.get("/history", getPatientHistory);
publicRoutes.post("/invoices/:invoiceId/midtrans", validate({ params: invoiceIdParamSchema }), createMidtransPayment);
publicRoutes.post("/midtrans/notification", handleMidtransNotification);
