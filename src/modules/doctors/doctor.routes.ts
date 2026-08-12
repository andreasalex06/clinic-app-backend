import { Role } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware";
import { authorize } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  createDoctor,
  deleteDoctor,
  getDoctorById,
  getDoctors,
  updateDoctor
} from "./doctor.controller";
import { createDoctorSchema, doctorIdParamSchema, updateDoctorSchema } from "./doctor.validation";

export const doctorRoutes = Router();

doctorRoutes.use(authenticate);
doctorRoutes.get("/", authorize(Role.ADMIN, Role.STAFF, Role.DOCTOR), getDoctors);
doctorRoutes.get("/:id", authorize(Role.ADMIN, Role.STAFF, Role.DOCTOR), validate({ params: doctorIdParamSchema }), getDoctorById);
doctorRoutes.post("/", authorize(Role.ADMIN), validate({ body: createDoctorSchema }), createDoctor);
doctorRoutes.patch("/:id", authorize(Role.ADMIN), validate({ params: doctorIdParamSchema, body: updateDoctorSchema }), updateDoctor);
doctorRoutes.delete("/:id", authorize(Role.ADMIN), validate({ params: doctorIdParamSchema }), deleteDoctor);
