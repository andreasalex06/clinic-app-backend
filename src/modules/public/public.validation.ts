import { z } from "zod";

export const patientRegisterSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(8),
  password: z.string().min(6),
  gender: z.enum(["MALE", "FEMALE"]),
  birthDate: z.coerce.date(),
  address: z.string().min(5)
});

export const patientLoginSchema = z.object({
  phone: z.string().min(8),
  password: z.string().min(6)
});

export const publicCheckInSchema = z.object({
  doctorId: z.string().min(1)
});

export const visitIdParamSchema = z.object({
  visitId: z.string().min(1)
});

export const invoiceIdParamSchema = z.object({
  invoiceId: z.string().min(1)
});
