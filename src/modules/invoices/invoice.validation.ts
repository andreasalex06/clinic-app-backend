import { z } from "zod";

export const visitInvoiceParamSchema = z.object({
  visitId: z.string().min(1)
});

export const invoiceIdParamSchema = z.object({
  id: z.string().min(1)
});

export const invoiceQuerySchema = z.object({
  status: z.enum(["UNPAID", "PAID"]).optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(50).optional()
});
