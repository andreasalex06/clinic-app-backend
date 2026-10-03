import { PharmacyStatus, VisitStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../config/prisma";
import { getQueueEstimate } from "../public/public.controller";
import { clinicKnowledge, type AssistantContext } from "./assistant.context";

const emptyArgs = { type: "object", properties: {}, additionalProperties: false };

export const assistantTools = [
  { type: "function", function: { name: "get_clinic_info", description: "Get clinic procedures and service information from the application.", parameters: { type: "object", required: ["topic"], properties: { topic: { type: "string", enum: ["nama", "registrasi", "masuk", "ambilAntrean", "pantauAntrean", "perkiraanWaktu", "konsultasi", "bayar", "obat", "riwayat", "unduh", "akun", "batasData"] } }, additionalProperties: false } } },
  { type: "function", function: { name: "list_doctors", description: "List active doctors eligible for this patient's age; optionally filter by specialty text.", parameters: { type: "object", properties: { specialization: { type: "string", maxLength: 80 } }, additionalProperties: false } } },
  { type: "function", function: { name: "recommend_doctors", description: "Return active doctors for the specialty the AI selected after understanding the complaint. The model must select specialization exactly from the application doctor-specialty catalog, not diagnose. Use only when complaint gives enough context.", parameters: { type: "object", required: ["complaint", "specialization"], properties: { complaint: { type: "string", minLength: 2, maxLength: 500 }, specialization: { type: "string", minLength: 3, maxLength: 100 } }, additionalProperties: false } } },
  { type: "function", function: { name: "get_consultation_duration_stats", description: "Untuk pertanyaan umum berapa lama, berapa menit, biasanya berapa lama ngobrol atau periksa dengan dokter, atau lama satu sesi/satu kali konsultasi. Mengembalikan rata-rata agregat durasi kunjungan selesai 60 hari terakhir; tidak memuat identitas, catatan, atau data pasien.", parameters: emptyArgs } },
  { type: "function", function: { name: "get_my_profile", description: "Get this authenticated patient's own basic profile. Never returns credentials.", parameters: emptyArgs } },
  { type: "function", function: { name: "get_my_queue_status", description: "Get this authenticated patient's active queue and estimate for today.", parameters: emptyArgs } },
  { type: "function", function: { name: "get_my_visit_history", description: "Search and paginate this authenticated patient's own visits. Optional exact visit number, date range (YYYY-MM-DD), limit (1-50, default 20), and offset (0-1000). Includes bounded invoice, pharmacy, and consultation summaries.", parameters: { type: "object", properties: { visitNumber: { type: "string", maxLength: 40 }, fromDate: { type: "string", format: "date" }, toDate: { type: "string", format: "date" }, limit: { type: "integer", minimum: 1, maximum: 50 }, offset: { type: "integer", minimum: 0, maximum: 1000 } }, additionalProperties: false } } },
  { type: "function", function: { name: "get_my_invoice_status", description: "Get this authenticated patient's latest invoice or invoice for an exact visit number.", parameters: { type: "object", properties: { visitNumber: { type: "string", maxLength: 40 } }, additionalProperties: false } } },
  { type: "function", function: { name: "get_my_pharmacy_status", description: "Get this authenticated patient's latest pharmacy order or order for an exact visit number.", parameters: { type: "object", properties: { visitNumber: { type: "string", maxLength: 40 } }, additionalProperties: false } } },
  { type: "function", function: { name: "get_my_latest_consultation", description: "Ambil catatan, diagnosis, atau resep dari konsultasi pasien yang sedang login. Jangan gunakan untuk menanyakan durasi umum sesi konsultasi.", parameters: { type: "object", properties: { visitNumber: { type: "string", maxLength: 40 } }, additionalProperties: false } } },
  { type: "function", function: { name: "mark_urgent", description: "Mark that the patient reports a possible emergency now, so the reply is highlighted and advises urgent in-person care. Do not use for ordinary or past symptoms.", parameters: emptyArgs } },
  { type: "function", function: { name: "prepare_queue_confirmation", description: "Prepare an eligible doctor card when the patient explicitly wants to take a queue. This does not create the queue; the patient must confirm in the existing UI.", parameters: { type: "object", required: ["doctorId"], properties: { doctorId: { type: "string", minLength: 1, maxLength: 100 } }, additionalProperties: false } } }
] as const;

const visitSelect = { visitNumber: true, queueDate: true, status: true, doctor: { select: { name: true } } } as const;
const visitStatuses: Record<VisitStatus, string> = {
  WAITING: "menunggu konsultasi", IN_CONSULTATION: "sedang konsultasi", COMPLETED: "konsultasi selesai", CANCELLED: "dibatalkan"
};
const clinicInfoByTopic = { nama: clinicKnowledge.nama, ...clinicKnowledge.alur, batasData: clinicKnowledge.batasData };
const pharmacyStatuses: Record<PharmacyStatus, string> = {
  WAITING_PAYMENT: "menunggu pembayaran", PREPARING: "sedang disiapkan", READY_FOR_PICKUP: "siap diambil", COMPLETED: "sudah diambil"
};

function formatDate(date: Date, time = false) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta", day: "numeric", month: "long", year: "numeric",
    ...(time ? { hour: "2-digit", minute: "2-digit", hour12: false, timeZoneName: "short" } : {})
  }).format(date);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function queueCode(number: number, index: number) {
  let prefix = "";
  while (index > 0) {
    index -= 1;
    prefix = String.fromCharCode(65 + index % 26) + prefix;
    index = Math.floor(index / 26);
  }
  return `${prefix}-${String(number).padStart(3, "0")}`;
}

function visitSummary(visit: { visitNumber: string; queueDate: Date; status: VisitStatus; doctor: { name: string } }) {
  return { nomorKunjungan: visit.visitNumber, tanggal: formatDate(visit.queueDate), dokter: visit.doctor.name, status: visitStatuses[visit.status] };
}

function isPediatrician(specialization: string) {
  return /spesialis anak|\bsp\.?\s*a\b/i.test(specialization);
}

function isAgeEligible(specialization: string, patientAge: number | null) {
  if (patientAge === null) return false;
  return (patientAge < 18) === isPediatrician(specialization);
}

function parseDateBoundary(value: string | undefined, end = false) {
  if (!value) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const validationDate = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(validationDate.getTime()) || validationDate.toISOString().slice(0, 10) !== value) return undefined;
  const date = new Date(`${value}T00:00:00+07:00`);
  if (end) date.setTime(date.getTime() + 24 * 60 * 60 * 1000);
  return date;
}

const argumentSchemas = {
  get_clinic_info: z.object({ topic: z.enum(["nama", "registrasi", "masuk", "ambilAntrean", "pantauAntrean", "perkiraanWaktu", "konsultasi", "bayar", "obat", "riwayat", "unduh", "akun", "batasData"]) }).strict(),
  list_doctors: z.object({ specialization: z.string().trim().max(80).optional() }).strict(),
  recommend_doctors: z.object({ complaint: z.string().trim().min(2).max(500), specialization: z.string().trim().min(3).max(100) }).strict(),
  get_consultation_duration_stats: z.object({}).strict(),
  get_my_profile: z.object({}).strict(),
  get_my_queue_status: z.object({}).strict(),
  get_my_visit_history: z.object({ visitNumber: z.string().trim().max(40).optional(), fromDate: z.string().optional(), toDate: z.string().optional(), limit: z.number().int().min(1).max(50).optional(), offset: z.number().int().min(0).max(1000).optional() }).strict(),
  get_my_invoice_status: z.object({ visitNumber: z.string().trim().max(40).optional() }).strict(),
  get_my_pharmacy_status: z.object({ visitNumber: z.string().trim().max(40).optional() }).strict(),
  get_my_latest_consultation: z.object({ visitNumber: z.string().trim().max(40).optional() }).strict(),
  mark_urgent: z.object({}).strict(),
  prepare_queue_confirmation: z.object({ doctorId: z.string().min(1).max(100) }).strict()
};

export type AssistantToolName = keyof typeof argumentSchemas;
export type AssistantToolEnvironment = { patientId: string; patientAge: number | null };
export type AssistantToolResult = { content: string; doctors: Array<{ id: string; name: string; specialization: string; avatarUrl: string | null; consultationFee: number | null }> };

async function runTool(name: AssistantToolName, args: unknown, environment: AssistantToolEnvironment): Promise<AssistantToolResult> {
  const parsed = argumentSchemas[name].safeParse(args);
  if (!parsed.success) return { content: "Argumen tool tidak valid.", doctors: [] };
  const empty = (value: unknown): AssistantToolResult => ({ content: JSON.stringify(value), doctors: [] });

  switch (name) {
    case "get_clinic_info": {
      const { topic } = argumentSchemas.get_clinic_info.parse(args);
      return empty({ [topic]: clinicInfoByTopic[topic] });
    }
    case "list_doctors": {
      const { specialization } = argumentSchemas.list_doctors.parse(args);
      const [doctors, fees] = await Promise.all([
        prisma.doctor.findMany({ where: { isActive: true }, select: { id: true, name: true, specialization: true, avatarUrl: true }, orderBy: { name: "asc" } }),
        prisma.treatment.findMany({ where: { name: "Biaya konsultasi dokter spesialis" }, select: { price: true } })
      ]);
      const consultationFee = fees.length === 1 ? fees[0].price : null;
      const eligible = doctors.filter((doctor) => isAgeEligible(doctor.specialization, environment.patientAge))
        .filter((doctor) => !specialization || `${doctor.name} ${doctor.specialization}`.toLocaleLowerCase().includes(specialization.toLocaleLowerCase()))
        .map((doctor) => ({ ...doctor, consultationFee }));
      return { content: JSON.stringify(eligible), doctors: eligible };
    }
    case "recommend_doctors": {
      const { complaint, specialization } = argumentSchemas.recommend_doctors.parse(args);
      const [available, fees] = await Promise.all([
        prisma.doctor.findMany({ where: { isActive: true }, select: { id: true, name: true, specialization: true, avatarUrl: true }, orderBy: { name: "asc" } }),
        prisma.treatment.findMany({ where: { name: "Biaya konsultasi dokter spesialis" }, select: { price: true } })
      ]);
      const eligible = available.filter((doctor) => isAgeEligible(doctor.specialization, environment.patientAge));
      const matchedDoctors = eligible.filter((doctor) => doctor.specialization.toLocaleLowerCase("id-ID") === specialization.toLocaleLowerCase("id-ID"));
      const recommended = matchedDoctors.map((doctor) => ({ ...doctor, consultationFee: fees.length === 1 ? fees[0].price : null }));
      return { content: JSON.stringify({ keluhan: complaint, spesialisasiDipilih: specialization, rekomendasi: recommended, panduan: "Pencocokan awal berdasarkan analisis AI terhadap keluhan, bukan diagnosis. Jangan mengganti spesialisasi jika tidak ada dokter yang sesuai." }), doctors: recommended };
    }
    case "get_consultation_duration_stats": {
      const start = new Date();
      start.setDate(start.getDate() - 60);
      const visits = await prisma.visit.findMany({
        where: { status: VisitStatus.COMPLETED, consultationStartedAt: { not: null }, consultationEndedAt: { gte: start } },
        select: { consultationStartedAt: true, consultationEndedAt: true, doctor: { select: { name: true } } },
        orderBy: { consultationEndedAt: "desc" }, take: 1000
      });
      const validVisits = visits.flatMap((visit) => {
        if (!visit.consultationStartedAt || !visit.consultationEndedAt) return [];
        const minutes = (visit.consultationEndedAt.getTime() - visit.consultationStartedAt.getTime()) / 60_000;
        return minutes > 0 && minutes <= 180 ? [{ doctor: visit.doctor.name, minutes }] : [];
      });
      const average = (values: number[]) => Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
      const overall = validVisits.length >= 3 ? { rataRataMenit: average(validVisits.map(({ minutes }) => minutes)), jumlahSampel: validVisits.length } : null;
      const byDoctor = [...new Set(validVisits.map(({ doctor }) => doctor))].flatMap((doctor) => {
        const durations = validVisits.filter((visit) => visit.doctor === doctor).map(({ minutes }) => minutes);
        return durations.length >= 3 ? [{ dokter: doctor, rataRataMenit: average(durations), jumlahSampel: durations.length }] : [];
      });
      return empty({ periodeHari: 60, rataRataKlinik: overall, rataRataPerDokter: byDoctor, fallbackJikaDataKurangMenit: overall ? null : 15 });
    }
    case "get_my_profile": {
      const patient = await prisma.patient.findUnique({
        where: { id: environment.patientId }, select: { name: true, phone: true, gender: true, birthDate: true, address: true }
      });
      return empty(patient ? {
        nama: patient.name, telepon: patient.phone, jenisKelamin: patient.gender === "MALE" ? "laki-laki" : "perempuan",
        tanggalLahir: formatDate(patient.birthDate), alamat: patient.address
      } : { profil: null });
    }
    case "get_my_queue_status": {
      const queue = await prisma.visit.findFirst({
        where: { patientId: environment.patientId, queueDate: startOfDay(new Date()), status: { in: [VisitStatus.WAITING, VisitStatus.IN_CONSULTATION] } },
        select: { ...visitSelect, queueNumber: true, doctorId: true, status: true, doctor: { select: { name: true, queueIndex: true } } },
        orderBy: { checkInTime: "desc" }
      });
      if (!queue) return empty({ antreanAktifHariIni: null });
      const estimate = queue.status === VisitStatus.WAITING ? await getQueueEstimate(queue) : null;
      return empty({ antreanAktifHariIni: {
        ...visitSummary(queue), nomorAntrean: queueCode(queue.queueNumber, queue.doctor.queueIndex),
        sisaAntrean: estimate?.waitingAhead ?? null,
        perkiraanMulai: estimate?.estimatedConsultationAt ? formatDate(estimate.estimatedConsultationAt, true) : null
      } });
    }
    case "get_my_visit_history": {
      const { visitNumber, fromDate, toDate, limit = 20, offset = 0 } = argumentSchemas.get_my_visit_history.parse(args);
      if ((fromDate && !parseDateBoundary(fromDate)) || (toDate && !parseDateBoundary(toDate, true))) return empty({ error: "Tanggal harus berformat YYYY-MM-DD dan merupakan tanggal valid." });
      const from = parseDateBoundary(fromDate);
      const to = parseDateBoundary(toDate, true);
      const where = {
        patientId: environment.patientId,
        ...(visitNumber ? { visitNumber } : {}),
        ...(from || to ? { queueDate: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } } : {})
      };
      const [visits, total] = await Promise.all([
        prisma.visit.findMany({
          where, select: {
            ...visitSelect,
            invoice: { select: { invoiceNo: true, total: true, status: true, paidAt: true } },
            pharmacyOrder: { select: { status: true, queueNumber: true } },
            consultation: { select: {
              complaint: true, notes: true, diagnosis: { select: { name: true } },
              medicines: { select: { quantity: true, instructions: true, medicine: { select: { name: true } } }, take: 20 }
            } }
          }, orderBy: { checkInTime: "desc" }, take: limit, skip: offset
        }),
        prisma.visit.count({ where })
      ]);
      return empty({
        kunjungan: visits.map((visit) => ({
          ...visitSummary(visit), keluhanSaatDaftar: visit.consultation?.complaint.slice(0, 500) ?? null,
          catatanDokter: visit.consultation?.notes?.slice(0, 1000) ?? null,
          diagnosisTercatat: visit.consultation?.diagnosis.name ?? null,
          resepTercatat: visit.consultation?.medicines.map(({ medicine, quantity, instructions }) => ({ obat: medicine.name, jumlah: quantity, aturanDariDokter: instructions })) ?? [],
          tagihan: visit.invoice ? { nomor: visit.invoice.invoiceNo, totalRupiah: visit.invoice.total, status: visit.invoice.status === "PAID" ? "lunas" : "belum dibayar", dibayarPada: visit.invoice.paidAt ? formatDate(visit.invoice.paidAt, true) : null } : null,
          farmasi: visit.pharmacyOrder ? { status: pharmacyStatuses[visit.pharmacyOrder.status], nomorAntrean: visit.pharmacyOrder.queueNumber } : null
        })), total, limit, offset, adaBerikutnya: offset + visits.length < total
      });
    }
    case "get_my_invoice_status": {
      const { visitNumber } = argumentSchemas.get_my_invoice_status.parse(args);
      const invoice = await prisma.invoice.findFirst({
        where: { visit: { patientId: environment.patientId, ...(visitNumber ? { visitNumber } : {}) } },
        select: { invoiceNo: true, total: true, status: true, paidAt: true, midtransPaymentType: true, visit: { select: visitSelect } },
        orderBy: { createdAt: "desc" }
      });
      return empty(invoice ? {
        ...visitSummary(invoice.visit), nomorInvoice: invoice.invoiceNo, totalRupiah: invoice.total,
        statusPembayaran: invoice.status === "PAID" ? "lunas" : "belum dibayar",
        dibayarPada: invoice.paidAt ? formatDate(invoice.paidAt, true) : null, metode: invoice.midtransPaymentType
      } : { tagihanTerakhir: null });
    }
    case "get_my_pharmacy_status": {
      const { visitNumber } = argumentSchemas.get_my_pharmacy_status.parse(args);
      const order = await prisma.pharmacyOrder.findFirst({
        where: { visit: { patientId: environment.patientId, status: { not: VisitStatus.CANCELLED }, ...(visitNumber ? { visitNumber } : {}) } },
        select: { status: true, queueNumber: true, visit: { select: visitSelect } }, orderBy: { createdAt: "desc" }
      });
      return empty(order ? {
        ...visitSummary(order.visit), statusObat: pharmacyStatuses[order.status], nomorAntreanFarmasi: order.queueNumber
      } : { obatTerakhir: null });
    }
    case "get_my_latest_consultation": {
      const { visitNumber } = argumentSchemas.get_my_latest_consultation.parse(args);
      const consultation = await prisma.consultation.findFirst({
        where: { visit: { patientId: environment.patientId, ...(visitNumber ? { visitNumber } : {}) } },
        select: {
          diagnosis: { select: { name: true } }, notes: true, visit: { select: visitSelect },
          medicines: { select: { quantity: true, instructions: true, medicine: { select: { name: true } } }, take: 20 }
        }, orderBy: { createdAt: "desc" }
      });
      return empty(consultation ? {
        ...visitSummary(consultation.visit), diagnosisTercatat: consultation.diagnosis.name,
        catatanDokter: consultation.notes?.slice(0, 1000) ?? null,
        catatanDipotong: (consultation.notes?.length ?? 0) > 1000,
        resepTercatat: consultation.medicines.map(({ medicine, quantity, instructions }) => ({ obat: medicine.name, jumlah: quantity, aturanDariDokter: instructions }))
      } : { konsultasiTerakhir: null });
    }
    case "mark_urgent":
      return empty({ arahan: "Sarankan segera mencari layanan darurat atau pergi ke IGD. Jangan mendiagnosis atau memberi resep." });
    case "prepare_queue_confirmation": {
      const { doctorId } = argumentSchemas.prepare_queue_confirmation.parse(args);
      const doctor = await prisma.doctor.findUnique({
        where: { id: doctorId }, select: { id: true, name: true, specialization: true, avatarUrl: true, isActive: true }
      });
      if (!doctor?.isActive || !isAgeEligible(doctor.specialization, environment.patientAge)) {
        return empty({ siapKonfirmasi: false, alasan: "Dokter tidak tersedia untuk kelompok usia pasien." });
      }
      const [fees, activeQueue] = await Promise.all([
        prisma.treatment.findMany({ where: { name: "Biaya konsultasi dokter spesialis" }, select: { price: true } }),
        prisma.visit.findFirst({
          where: { patientId: environment.patientId, queueDate: startOfDay(new Date()), status: { in: [VisitStatus.WAITING, VisitStatus.IN_CONSULTATION] } },
          select: { id: true }
        })
      ]);
      if (activeQueue) return empty({ siapKonfirmasi: false, alasan: "Pasien sudah memiliki antrean aktif hari ini. Gunakan get_my_queue_status untuk melihatnya." });
      const card = { ...doctor, consultationFee: fees.length === 1 ? fees[0].price : null };
      return { content: JSON.stringify({ siapKonfirmasi: true, langkah: "Tampilkan card dokter. Pasien harus menekan Pilih dokter lalu mengonfirmasi pada dialog aplikasi; jangan mengklaim antrean sudah dibuat." }), doctors: [card] };
    }
  }
}

export async function executeAssistantTool(name: string, args: unknown, environment: AssistantToolEnvironment) {
  if (!Object.hasOwn(argumentSchemas, name)) return { content: "Tool tidak tersedia.", doctors: [] } satisfies AssistantToolResult;
  return runTool(name as AssistantToolName, args, environment);
}
