import { z } from "zod";

export const masterIdParamSchema = z.object({
  id: z.string().min(1)
});

export const createDiagnosisSchema = z.object({
  code: z.string().min(2),
  name: z.string().min(2)
});

export const updateDiagnosisSchema = createDiagnosisSchema.partial();

export const createTreatmentSchema = z.object({
  name: z.string().min(2),
  price: z.coerce.number().int().min(0)
});

export const updateTreatmentSchema = createTreatmentSchema.partial();

export const createMedicineSchema = z.object({
  name: z.string().min(2),
  price: z.coerce.number().int().min(0),
  stock: z.coerce.number().int().min(0)
});

export const updateMedicineSchema = createMedicineSchema.partial();
