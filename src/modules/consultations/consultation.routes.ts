import { Role } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware";
import { authorize } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { createConsultation, getConsultationByVisit } from "./consultation.controller";
import { createConsultationSchema, visitIdParamSchema } from "./consultation.validation";

export const consultationRoutes = Router();

consultationRoutes.use(authenticate);
consultationRoutes.post("/", authorize(Role.ADMIN, Role.DOCTOR), validate({ body: createConsultationSchema }), createConsultation);
consultationRoutes.get("/:visitId", authorize(Role.ADMIN, Role.STAFF, Role.DOCTOR), validate({ params: visitIdParamSchema }), getConsultationByVisit);
