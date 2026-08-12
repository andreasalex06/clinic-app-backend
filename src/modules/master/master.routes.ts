import { Role } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware";
import { authorize } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  createDiagnosis,
  createMedicine,
  createTreatment,
  deleteDiagnosis,
  deleteMedicine,
  deleteTreatment,
  getDiagnoses,
  getMedicines,
  getTreatments,
  updateDiagnosis,
  updateMedicine,
  updateTreatment
} from "./master.controller";
import {
  createDiagnosisSchema,
  createMedicineSchema,
  createTreatmentSchema,
  masterIdParamSchema,
  updateDiagnosisSchema,
  updateMedicineSchema,
  updateTreatmentSchema
} from "./master.validation";

export const masterRoutes = Router();

masterRoutes.use(authenticate);

masterRoutes.get("/diagnoses", authorize(Role.ADMIN, Role.DOCTOR), getDiagnoses);
masterRoutes.post("/diagnoses", authorize(Role.ADMIN), validate({ body: createDiagnosisSchema }), createDiagnosis);
masterRoutes.patch("/diagnoses/:id", authorize(Role.ADMIN), validate({ params: masterIdParamSchema, body: updateDiagnosisSchema }), updateDiagnosis);
masterRoutes.delete("/diagnoses/:id", authorize(Role.ADMIN), validate({ params: masterIdParamSchema }), deleteDiagnosis);

masterRoutes.get("/treatments", authorize(Role.ADMIN, Role.DOCTOR), getTreatments);
masterRoutes.post("/treatments", authorize(Role.ADMIN), validate({ body: createTreatmentSchema }), createTreatment);
masterRoutes.patch("/treatments/:id", authorize(Role.ADMIN), validate({ params: masterIdParamSchema, body: updateTreatmentSchema }), updateTreatment);
masterRoutes.delete("/treatments/:id", authorize(Role.ADMIN), validate({ params: masterIdParamSchema }), deleteTreatment);

masterRoutes.get("/medicines", authorize(Role.ADMIN, Role.DOCTOR), getMedicines);
masterRoutes.post("/medicines", authorize(Role.ADMIN), validate({ body: createMedicineSchema }), createMedicine);
masterRoutes.patch("/medicines/:id", authorize(Role.ADMIN), validate({ params: masterIdParamSchema, body: updateMedicineSchema }), updateMedicine);
masterRoutes.delete("/medicines/:id", authorize(Role.ADMIN), validate({ params: masterIdParamSchema }), deleteMedicine);
