import { Role } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware";
import { authorize } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { getInvoiceByVisit, getInvoices, payInvoice } from "./invoice.controller";
import { invoiceIdParamSchema, invoiceQuerySchema, visitInvoiceParamSchema } from "./invoice.validation";

export const invoiceRoutes = Router();

invoiceRoutes.use(authenticate);
invoiceRoutes.get("/", authorize(Role.ADMIN, Role.STAFF, Role.DOCTOR), validate({ query: invoiceQuerySchema }), getInvoices);
invoiceRoutes.get("/:visitId", authorize(Role.ADMIN, Role.STAFF, Role.DOCTOR), validate({ params: visitInvoiceParamSchema }), getInvoiceByVisit);
invoiceRoutes.patch("/:id/pay", authorize(Role.ADMIN, Role.STAFF), validate({ params: invoiceIdParamSchema }), payInvoice);
