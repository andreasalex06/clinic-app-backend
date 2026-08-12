import { z } from "zod";

export const visitIdParamSchema = z.object({
  id: z.string().min(1)
});

export const visitQuerySchema = z.object({
  date: z.enum(["today"]).optional(),
  status: z.enum(["WAITING", "IN_CONSULTATION", "COMPLETED", "CANCELLED"]).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(50).optional()
});

export const createVisitSchema = z.object({
  patientId: z.string().min(1),
  doctorId: z.string().min(1)
});

export const updateVisitStatusSchema = z.object({
  status: z.enum(["WAITING", "IN_CONSULTATION", "COMPLETED", "CANCELLED"])
});
