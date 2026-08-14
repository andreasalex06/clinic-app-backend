import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticate } from "../../middlewares/auth.middleware";
import { authorize } from "../../middlewares/role.middleware";
import { getFinanceSummary } from "./finance.controller";

export const financeRoutes = Router();

financeRoutes.get("/", authenticate, authorize(Role.ADMIN, Role.STAFF), getFinanceSummary);
