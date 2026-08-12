import { z } from "zod";

export const doctorIdParamSchema = z.object({
  id: z.string().min(1)
});

export const createDoctorSchema = z.object({
  name: z.string().min(2),
  specialization: z.string().min(2),
  phone: z.string().min(8)
});

export const updateDoctorSchema = createDoctorSchema.partial();
