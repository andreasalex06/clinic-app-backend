import { Role } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware";
import { authorize } from "../../middlewares/role.middleware";
import { getDashboard } from "./dashboard.controller";

export const dashboardRoutes = Router();

dashboardRoutes.get("/", authenticate, authorize(Role.ADMIN, Role.STAFF, Role.DOCTOR), getDashboard);
