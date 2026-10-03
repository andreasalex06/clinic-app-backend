import { NextFunction, Request, Response } from "express";
import { getAuthenticatedPatientToken } from "../public/public.controller";
import { AppError } from "../../utils/AppError";
import { loadAssistantContext } from "./assistant.context";
import { askOllama, assistantChatSchema } from "./assistant.ollama";

export { assistantChatSchema } from "./assistant.ollama";

type RateEntry = { count: number; resetAt: number };
const patientRateLimits = new Map<string, RateEntry>();
const MAX_REQUESTS_PER_MINUTE = 12;

function enforcePatientRateLimit(patientId: string) {
  const now = Date.now();
  const current = patientRateLimits.get(patientId);
  if (!current || current.resetAt <= now) {
    for (const [id, entry] of patientRateLimits) {
      if (entry.resetAt <= now) patientRateLimits.delete(id);
    }
    patientRateLimits.set(patientId, { count: 1, resetAt: now + 60_000 });
    return;
  }
  if (current.count >= MAX_REQUESTS_PER_MINUTE) throw new AppError("Batas chat sementara tercapai. Coba lagi sebentar.", 429);
  current.count += 1;
}

export async function assistantChat(req: Request, res: Response, next: NextFunction) {
  try {
    const patient = await getAuthenticatedPatientToken(req);
    enforcePatientRateLimit(patient.patientId);
    const input = assistantChatSchema.parse(req.body);
    const snapshot = await loadAssistantContext(patient.patientId);
    const reply = await askOllama(input, snapshot, patient.patientId);
    return res.json({ data: reply });
  } catch (error) {
    return next(error);
  }
}
