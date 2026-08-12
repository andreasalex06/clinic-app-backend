import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(2),
  email: z.email(),
  password: z.string().min(6),
  role: z.enum(["ADMIN", "STAFF", "DOCTOR"]).default("STAFF")
});

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1)
});
