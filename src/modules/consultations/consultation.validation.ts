import { z } from "zod";

export const visitIdParamSchema = z.object({
  visitId: z.string().min(1)
});

export const createConsultationSchema = z.object({
  visitId: z.string().min(1),
  complaint: z.string().min(5),
  diagnosisId: z.string().min(1),
  treatmentIds: z.array(z.string().min(1)).min(1),
  notes: z.string().optional(),
  medicines: z
    .array(
      z.object({
        medicineId: z.string().min(1),
        quantity: z.coerce.number().int().min(1)
      })
    )
    .default([])
});
