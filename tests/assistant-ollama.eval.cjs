// Opt-in: node --import tsx tests/assistant-ollama.eval.cjs [scenario]
// All records and tool results are fictional; no database reads or writes are made.
const assert = require("node:assert/strict");
process.env.DATABASE_URL = "postgresql://test:test@127.0.0.1:1/test";
process.env.JWT_SECRET = "assistant-evaluation-secret";
const { askOllama, assistantToolRuntime } = require("../src/modules/assistant/assistant.ollama.ts");
const { clinicKnowledge } = require("../src/modules/assistant/assistant.context.ts");
const { prisma } = require("../src/config/prisma.ts");

const specialties = ["Penyakit Dalam", "Anak", "Mata", "THT", "Saraf", "Jiwa", "Jantung", "Kandungan", "Bedah", "Kulit"];
const doctors = specialties.map((specialty, i) => ({
  id: `demo-doctor-${i + 1}`, name: `Dr. ${specialty} Demo`, specialization: `Spesialis ${specialty}`, avatarUrl: null, consultationFee: 75000
}));
const pastVisit = { nomorKunjungan: "VIS-DEMO-LAMA", tanggal: "23 September 2026", dokter: doctors[0].name, status: "konsultasi selesai" };
const latestConsultation = { ...pastVisit, diagnosisTercatat: "Migrain", catatanDokter: "Istirahat cukup dan kembali bila keluhan memburuk.", resepTercatat: [] };
const snapshot = {
  patientAge: 32,
  doctors,
  context: {
    klinik: clinicKnowledge,
    modePembayaran: "sandbox/simulasi",
    diperbaruiPada: "24 September 2026 pukul 23.23 WIB",
    biayaKonsultasiRupiah: 75000,
    dokterAktif: doctors.map(({ id, name, specialization }) => ({ id, nama: name, spesialisasi: specialization })),
    pasien: {
      antreanAktifHariIni: { nomorKunjungan: "VIS-DEMO-HARI-INI", tanggal: "24 September 2026", dokter: doctors[2].name, status: "menunggu konsultasi", nomorAntrean: "U-017", sisaAntrean: 2, perkiraanMulai: "24 September 2026 pukul 23.53 WIB" },
      riwayatTerbaru: [pastVisit],
      tagihanTerakhir: { ...pastVisit, nomorInvoice: "INV-DEMO", totalRupiah: 75000, statusPembayaran: "belum dibayar", dibayarPada: null, metode: null },
      obatTerakhir: { ...pastVisit, statusObat: "menunggu pembayaran", nomorAntreanFarmasi: null },
      konsultasiTerakhir: null
    },
    katalogSpesialisasiDokter: doctors.map(({ specialization }) => specialization)
  }
};

const runTool = assistantToolRuntime.execute;
assistantToolRuntime.execute = async (name, args) => {
  const empty = (value) => ({ content: JSON.stringify(value), doctors: [] });
  if (name === "get_clinic_info") return empty({ [args.topic]: clinicKnowledge.alur[args.topic] ?? clinicKnowledge[args.topic] });
  if (name === "list_doctors") {
    const result = doctors.filter((doctor) => doctor.specialization !== "Spesialis Anak")
      .filter((doctor) => !args.specialization || `${doctor.name} ${doctor.specialization}`.toLowerCase().includes(args.specialization.toLowerCase()));
    return { content: JSON.stringify(result), doctors: result };
  }
  if (name === "recommend_doctors") {
    const result = doctors.filter((doctor) => doctor.specialization !== "Spesialis Anak")
      .filter((doctor) => doctor.specialization === args.specialization);
    return { content: JSON.stringify({ keluhan: args.complaint, rekomendasi: result }), doctors: result };
  }
  if (name === "get_my_queue_status") return empty({ antreanAktifHariIni: snapshot.context.pasien.antreanAktifHariIni });
  if (name === "get_my_visit_history") return empty({ kunjungan: [], total: 0 });
  if (name === "get_my_invoice_status") return empty(snapshot.context.pasien.tagihanTerakhir);
  if (name === "get_my_pharmacy_status") return empty(snapshot.context.pasien.obatTerakhir);
  if (name === "get_my_latest_consultation") return empty(latestConsultation);
  if (name === "mark_urgent") return empty({ arahan: "Segera menuju IGD atau hubungi layanan darurat." });
  if (name === "prepare_queue_confirmation") return { content: JSON.stringify({ siapKonfirmasi: false }), doctors: [] };
  if (name === "get_my_profile") return empty({ nama: "Pasien Demo" });
  if (name === "get_consultation_duration_stats") return empty({ periodeHari: 60, rataRataKlinik: { rataRataMenit: 24, jumlahSampel: 32 }, rataRataPerDokter: [], fallbackJikaDataKurangMenit: null });
  return empty({});
};

const procedureCheck = (result) => {
  assert.match(result.reply, /Beranda/i);
  assert.match(result.reply, /Konsul/i);
  assert.match(result.reply, /Ambil Antrean/i);
};
const scenarios = [
  { name: "medicine-procedure", message: "ngambil obat nanti gimana prosesnya", history: [{ role: "user", text: "dokter THT ada?" }, { role: "model", text: "Dokter THT tersedia." }], check(result) { assert.match(result.reply, /farmasi/i); assert.match(result.reply, /siap/i); assert.equal(result.doctors.length, 0); assert.doesNotMatch(result.reply, /tidak menemukan kunjungan/i); } },
  { name: "medicine-paraphrase", message: "habis diperiksa terus resepnya ditebus lewat mana ya?", check(result) { assert.match(result.reply, /farmasi/i); assert.equal(result.doctors.length, 0); } },
  { name: "latest-consult-switch", message: "cek hasil konsul terakhir saya", history: [{ role: "user", text: "obat saya sudah siap?" }, { role: "model", text: "Status obat masih menunggu pembayaran." }], check(result) { assert.match(result.reply, /migrain|istirahat cukup/i); assert.doesNotMatch(result.reply, /menunggu pembayaran|farmasi/i); assert.equal(result.doctors.length, 0); } },
  { name: "procedure", message: "cara konsul gimana", check: procedureCheck },
  { name: "correction", message: "maksud saya cara ambil antri", history: [{ role: "user", text: "cara konsul gimana" }, { role: "model", text: "Silakan pilih spesialisasi: Sp.PD, Sp.A, Sp.M." }], check: procedureCheck },
  { name: "doctors", message: "dokter yang ada siapa aja, tampilkan semua", check(result) { assert.equal(result.doctors.length, doctors.filter((doctor) => doctor.specialization !== "Spesialis Anak").length); } },
  { name: "queue", message: "saya antrian ke berapa, sisa berapa dan kapan mulai?", check(result) { assert.match(result.reply, /U-017/); assert.match(result.reply, /23[.:]53/); assert.match(result.reply, /2/); } },
  { name: "payment", message: "tagihan terakhir saya sudah lunas? obatnya status apa?", check(result) { assert.match(result.reply, /belum (?:dibayar|lunas)/i); assert.match(result.reply, /menunggu pembayaran/i); } },
  { name: "unknown", message: "klinik buka pukul berapa?", check(result) { assert.match(result.reply, /belum tersedia|tidak tersedia|belum (?:ada|memiliki)|tidak (?:ada|memiliki|tahu)/i); } },
  { name: "complaint", message: "mata saya merah dan gatal, dokter mana yang bisa saya pilih?", check(result) { assert.ok(result.doctors.some((doctor) => doctor.id === "demo-doctor-3")); assert.equal(result.urgent, false); } },
  { name: "duration", message: "buat pasien lain biasanya berapa lama ngobrol sama dokternya sekali datang?", check(result) { assert.match(result.reply, /24 menit/); } },
  { name: "urgent", message: "saya sesak berat sekarang dan sulit bernapas", check(result) { assert.equal(result.urgent, true); assert.match(result.reply, /IGD|darurat/i); assert.equal(result.doctors.length, 0); } }
];

async function main() {
  const selected = process.argv[2] ? scenarios.filter((scenario) => scenario.name === process.argv[2]) : scenarios;
  assert.ok(selected.length, "Unknown scenario");
  for (const scenario of selected) {
    const start = Date.now();
    const runtimeSnapshot = { patientAge: 32, context: { klinik: clinicKnowledge, pasien: { usiaTahun: 32 }, katalogSpesialisasiDokter: snapshot.context.katalogSpesialisasiDokter } };
    const result = await askOllama({ message: scenario.message, history: scenario.history ?? [], demoAcknowledged: true }, runtimeSnapshot, "evaluation-patient");
    console.log(JSON.stringify({ scenario: scenario.name, seconds: (Date.now() - start) / 1000, ...result }));
    assert.doesNotMatch(result.reply, /^(halo|hai)\b/i);
    scenario.check(result);
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => {
  assistantToolRuntime.execute = runTool;
  await prisma.$disconnect();
});
