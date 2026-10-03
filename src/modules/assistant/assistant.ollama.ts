import { z } from "zod";
import { env } from "../../config/env";
import { AppError } from "../../utils/AppError";
import type { AssistantContext } from "./assistant.context";
import { assistantTools, executeAssistantTool } from "./assistant.tools";

export const assistantToolRuntime = { execute: executeAssistantTool };
const MAX_REPLY_LENGTH = 1200;
const MAX_TOOL_ROUNDS = 2;
const chatMessageSchema = z.discriminatedUnion("role", [
  z.object({ role: z.literal("user"), text: z.string().trim().min(1).max(800) }),
  z.object({ role: z.literal("model"), text: z.string().trim().min(1).max(MAX_REPLY_LENGTH), doctorIds: z.array(z.string().max(100)).max(100).optional() })
]);
export const assistantChatSchema = z.object({
  message: z.string().trim().min(1).max(800),
  history: z.array(chatMessageSchema).max(6).default([]),
  demoAcknowledged: z.literal(true)
});
type ChatInput = z.infer<typeof assistantChatSchema>;
type ToolResult = Awaited<ReturnType<typeof executeAssistantTool>>;
type PlannedCall = { name: string; args: Record<string, unknown> };
const toolNames: string[] = assistantTools.map(({ function: tool }) => tool.name);
const callFormat = {
  type: "object", additionalProperties: false, required: ["name", "arguments"],
  properties: { name: { type: "string", enum: toolNames }, arguments: { type: "object" } }
};
const callsFormat = { type: "array", maxItems: 4, items: callFormat };
const toolPlanFormat = { type: "object", additionalProperties: false, required: ["calls"], properties: { calls: callsFormat } };
const agentFormat = {
  type: "object", additionalProperties: false, required: ["reply", "doctorIds", "urgent", "additionalCalls"],
  properties: {
    reply: { type: "string" },
    doctorIds: { type: "array", items: { type: "string" }, maxItems: 20 },
    urgent: { type: "boolean" },
    additionalCalls: callsFormat
  }
};
const callSchema = z.object({ name: z.string(), arguments: z.record(z.string(), z.unknown()) }).strict();
const planSchema = z.object({ calls: z.array(callSchema).max(4) }).strict();
const agentSchema = z.object({
  reply: z.string().trim().max(MAX_REPLY_LENGTH),
  doctorIds: z.array(z.string()).max(20),
  urgent: z.boolean(),
  additionalCalls: z.array(callSchema).max(4)
}).strict();

function conversation(input: ChatInput) {
  return [
    ...input.history.map((entry) => ({ role: entry.role === "model" ? "assistant" : "user", content: entry.text })),
    { role: "user", content: input.message }
  ];
}

async function generate(messages: Array<{ role: string; content: string }>, format: object, tokens: number) {
  try {
    const response = await fetch(env.OLLAMA_BASE_URL + "/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(180_000),
      body: JSON.stringify({
        model: env.OLLAMA_MODEL, messages, format, stream: false,
        keep_alive: -1, think: false,
        options: { temperature: 0, num_predict: tokens, num_ctx: 6144 }
      })
    });
    if (!response.ok) throw new AppError("Ollama gagal memproses pesan. Coba lagi sebentar.", 502);
    const result = await response.json() as { message?: { content?: string }; done_reason?: string };
    if (!result.message?.content || result.done_reason === "length") throw new AppError("Jawaban AI belum lengkap. Coba kirim ulang pesan Anda.", 502);
    try { return JSON.parse(result.message.content) as unknown; }
    catch { throw new AppError("Format jawaban AI tidak valid. Coba lagi.", 502); }
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name)) throw new AppError("Analisis AI membutuhkan waktu terlalu lama. Coba lagi.", 504);
    throw new AppError("Ollama tidak dapat dijangkau. Pastikan model berjalan.", 503);
  }
}

function validateCalls(calls: Array<z.infer<typeof callSchema>>, snapshot: AssistantContext): PlannedCall[] {
  return calls.map(({ name, arguments: args }) => {
    if (!toolNames.includes(name)) throw new AppError("Tool AI tidak diizinkan.", 502);
    if (name === "recommend_doctors" && !snapshot.context.katalogSpesialisasiDokter.includes(String(args.specialization))) {
      throw new AppError("Spesialisasi pilihan AI tidak tersedia.", 502);
    }
    return { name, args };
  });
}

export async function planWithOllama(input: ChatInput, snapshot: AssistantContext): Promise<PlannedCall[]> {
  const parsed = planSchema.safeParse(await generate([
    { role: "system", content: [
      "Analisis maksud pesan TERBARU pasien. Pilih tool hanya untuk memperoleh fakta yang diperlukan; keluarkan JSON calls.",
      "Riwayat hanya konteks rujukan. Ikuti perpindahan topik dan jangan meneruskan topik lama.",
      "Bedakan prosedur umum (get_clinic_info), status pribadi (get_my_*), dan statistik umum.",
      "Untuk keluhan, pilih spesialisasi aktual yang paling relevan tanpa mendiagnosis. Bila informasi belum cukup, calls boleh kosong agar agent meminta klarifikasi.",
      "Data pribadi hanya pasien login. Jangan mengirim patientId sebagai argumen dan jangan mengubah data.",
      "KONTEKS PASIEN: " + JSON.stringify(snapshot.context.pasien),
      "SPESIALISASI AKTIF: " + JSON.stringify(snapshot.context.katalogSpesialisasiDokter),
      "TOOLS: " + JSON.stringify(assistantTools.map(({ function: tool }) => tool))
    ].join("\n") },
    ...conversation(input)
  ], toolPlanFormat, 384));
  if (!parsed.success) throw new AppError("Rencana AI tidak valid. Coba lagi.", 502);
  return validateCalls(parsed.data.calls, snapshot);
}

export async function askOllama(input: ChatInput, snapshot: AssistantContext, patientId: string) {
  const records: Array<{ tool: string; data: unknown }> = [];
  const doctors = new Map<string, ToolResult["doctors"][number]>();
  const executed = new Set<string>();

  const executeCalls = async (calls: PlannedCall[]) => {
    for (const call of calls) {
      const signature = JSON.stringify([call.name, call.args]);
      if (executed.has(signature)) continue;
      executed.add(signature);
      let result: ToolResult;
      try { result = await assistantToolRuntime.execute(call.name, call.args, { patientId, patientAge: snapshot.patientAge }); }
      catch { throw new AppError("Data klinik sementara tidak dapat diambil. Coba lagi.", 503); }
      let data: unknown;
      try { data = JSON.parse(result.content); } catch { data = { error: result.content }; }
      records.push({ tool: call.name, data });
      for (const doctor of result.doctors) doctors.set(doctor.id, doctor);
    }
  };

  await executeCalls(await planWithOllama(input, snapshot));
  let decision: z.infer<typeof agentSchema> | null = null;
  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const finalRound = round === MAX_TOOL_ROUNDS - 1;
    const parsed = agentSchema.safeParse(await generate([
      { role: "system", content: [
        "Anda agent layanan Sarana Medika. Fokus mutlak pada permintaan TERBARU pasien.",
        "Sebelum menjawab, nilai apakah bukti tool relevan dan cukup. Jangan menjawab topik lama hanya karena datanya tersedia.",
        finalRound
          ? "Ini putaran terakhir. additionalCalls harus []. Jawab dari bukti yang tersedia atau jelaskan data spesifik yang belum tersedia."
          : "Jika bukti salah atau kurang, isi additionalCalls dengan tool yang benar dan reply kosong. Jika cukup, additionalCalls=[] lalu jawab.",
        "Prosedur umum memakai konteks aplikasi; status pribadi memakai bukti tool. Hasil kosong hanya berlaku untuk data yang dicari.",
        "Ikuti perpindahan topik dalam percakapan. Jangan mencampur keluhan, obat, antrean, atau konsultasi jika tidak ditanyakan pada pesan terbaru.",
        "Jangan mengarang fakta, status, menu, dokter, diagnosis, resep, atau tindakan. Jangan ungkap proses berpikir atau nama tool.",
        "Jawab Bahasa Indonesia natural, tanpa salam, fokus 3-5 kalimat. doctorIds hanya kandidat relevan. Darurat saat ini: urgent=true.",
        "KONTEKS APLIKASI: " + JSON.stringify(snapshot.context),
        "BUKTI TOOL: " + JSON.stringify(records),
        "KANDIDAT DOKTER: " + JSON.stringify([...doctors.values()]),
        "TOOLS: " + JSON.stringify(assistantTools.map(({ function: tool }) => tool))
      ].join("\n") },
      ...conversation(input)
    ], agentFormat, 640));
    if (!parsed.success) throw new AppError("Jawaban AI tidak valid. Coba lagi.", 502);
    decision = parsed.data;
    if (!decision.additionalCalls.length) break;
    if (finalRound) throw new AppError("AI belum dapat menyelesaikan analisis data. Coba lagi.", 502);
    await executeCalls(validateCalls(decision.additionalCalls, snapshot));
  }

  if (!decision?.reply) throw new AppError("AI belum memberikan jawaban. Coba lagi.", 502);
  if (decision.reply.trim().toLowerCase() === input.message.trim().toLowerCase()) throw new AppError("AI belum menjawab pertanyaan. Coba lagi.", 502);
  if (decision.doctorIds.some((id) => !doctors.has(id))) throw new AppError("Rekomendasi AI tidak sesuai data dokter. Coba lagi.", 502);
  const reply = decision.reply.replace(/^(?:halo|hai)\b[\s,!.:-]*/i, "").trim();
  if (!reply) throw new AppError("AI belum memberikan penjelasan. Coba lagi.", 502);
  return {
    reply,
    urgent: decision.urgent,
    doctors: decision.urgent ? [] : [...new Set(decision.doctorIds)].map((id) => doctors.get(id)!)
  };
}
