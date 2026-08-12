import { Role } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware";
import { authorize } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { createVisit, getVisits, updateVisitStatus } from "./visit.controller";
import {
  createVisitSchema,
  updateVisitStatusSchema,
  visitIdParamSchema,
  visitQuerySchema
} from "./visit.validation";

export const visitRoutes = Router();

visitRoutes.use(authenticate);
visitRoutes.get("/", authorize(Role.ADMIN, Role.STAFF, Role.DOCTOR), validate({ query: visitQuerySchema }), getVisits);
visitRoutes.post("/", authorize(Role.ADMIN, Role.STAFF), validate({ body: createVisitSchema }), createVisit);
visitRoutes.patch("/:id/status", authorize(Role.ADMIN, Role.STAFF, Role.DOCTOR), validate({ params: visitIdParamSchema, body: updateVisitStatusSchema }), updateVisitStatus);
