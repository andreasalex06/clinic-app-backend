import { z } from "zod";

export const pharmacyOrderIdParamSchema = z.object({
  id: z.string().min(1)
});

export const pharmacyOrderQuerySchema = z.object({
  status: z.enum(["WAITING_PAYMENT", "PREPARING", "READY_FOR_PICKUP", "COMPLETED"]).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(50).optional()
});
