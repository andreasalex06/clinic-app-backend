import { Role } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware";
import { authorize } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  completePharmacyOrder,
  getPharmacyOrders,
  markPharmacyOrderReady,
  preparePharmacyOrder
} from "./pharmacy.controller";
import { pharmacyOrderIdParamSchema, pharmacyOrderQuerySchema } from "./pharmacy.validation";

export const pharmacyRoutes = Router();

pharmacyRoutes.use(authenticate);
pharmacyRoutes.get("/", authorize(Role.ADMIN, Role.STAFF, Role.DOCTOR), validate({ query: pharmacyOrderQuerySchema }), getPharmacyOrders);
pharmacyRoutes.patch("/:id/prepare", authorize(Role.ADMIN, Role.STAFF), validate({ params: pharmacyOrderIdParamSchema }), preparePharmacyOrder);
pharmacyRoutes.patch("/:id/ready", authorize(Role.ADMIN, Role.STAFF), validate({ params: pharmacyOrderIdParamSchema }), markPharmacyOrderReady);
pharmacyRoutes.patch("/:id/complete", authorize(Role.ADMIN, Role.STAFF), validate({ params: pharmacyOrderIdParamSchema }), completePharmacyOrder);
