import { Router } from "express";
import { Role } from "@prisma/client";
import { authorize } from "../../middlewares/role.middleware";
import { authenticate } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { login, me, register } from "./auth.controller";
import { loginSchema, registerSchema } from "./auth.validation";

export const authRoutes = Router();

authRoutes.post("/register", authenticate, authorize(Role.ADMIN), validate({ body: registerSchema }), register);
authRoutes.post("/login", validate({ body: loginSchema }), login);
authRoutes.get("/me", authenticate, me);
