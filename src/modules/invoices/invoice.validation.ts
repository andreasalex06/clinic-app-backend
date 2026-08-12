import { z } from "zod";

export const visitInvoiceParamSchema = z.object({
  visitId: z.string().min(1)
});

export const invoiceIdParamSchema = z.object({
  id: z.string().min(1)
});
