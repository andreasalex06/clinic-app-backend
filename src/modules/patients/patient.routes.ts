import { Role } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware";
import { authorize } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  createPatient,
  deletePatient,
  getPatientById,
  getPatients,
  updatePatient
} from "./patient.controller";
import { createPatientSchema, idParamSchema, updatePatientSchema } from "./patient.validation";

export const patientRoutes = Router();
 
patientRoutes.use(authenticate);
patientRoutes.get("/", authorize(Role.ADMIN, Role.STAFF, Role.DOCTOR), getPatients);
patientRoutes.get("/:id", authorize(Role.ADMIN, Role.STAFF, Role.DOCTOR), validate({ params: idParamSchema }), getPatientById);
patientRoutes.post("/", authorize(Role.ADMIN, Role.STAFF), validate({ body: createPatientSchema }), createPatient);
patientRoutes.patch("/:id", authorize(Role.ADMIN, Role.STAFF), validate({ params: idParamSchema, body: updatePatientSchema }), updatePatient);
patientRoutes.delete("/:id", authorize(Role.ADMIN), validate({ params: idParamSchema }), deletePatient);
