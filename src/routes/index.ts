import { Router } from "express";
import { authRoutes } from "../modules/auth/auth.routes";
import { consultationRoutes } from "../modules/consultations/consultation.routes";
import { dashboardRoutes } from "../modules/dashboard/dashboard.routes";
import { doctorRoutes } from "../modules/doctors/doctor.routes";
import { invoiceRoutes } from "../modules/invoices/invoice.routes";
import { masterRoutes } from "../modules/master/master.routes";
import { patientRoutes } from "../modules/patients/patient.routes";
import { visitRoutes } from "../modules/visits/visit.routes";

export const routes = Router();

routes.get("/test", (_req, res) => {
  res.json({ message: "Clinic API is running" });
});

routes.use("/auth", authRoutes);
routes.use("/dashboard", dashboardRoutes);
routes.use("/patients", patientRoutes);
routes.use("/doctors", doctorRoutes);
routes.use("/visits", visitRoutes);
routes.use("/consultations", consultationRoutes);
routes.use("/invoices", invoiceRoutes);
routes.use("/", masterRoutes);
