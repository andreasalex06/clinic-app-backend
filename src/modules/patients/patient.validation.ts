import { z } from "zod";

export const idParamSchema = z.object({
  id: z.string().min(1)
});

export const patientQuerySchema = z.object({
  search: z.string().trim().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(50).optional()
});

export const createPatientSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(8),
  gender: z.enum(["MALE", "FEMALE"]),
  birthDate: z.coerce.date(),
  address: z.string().min(5)
});

export const updatePatientSchema = createPatientSchema.partial();
