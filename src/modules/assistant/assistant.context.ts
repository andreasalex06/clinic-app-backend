import { prisma } from "../../config/prisma";

// Keep button names and procedures aligned with the patient screens.
export const clinicKnowledge = {
  nama: "Sarana Medika",
  alur: {
    registrasi: "Halaman masuk > Registrasi > isi nama, nomor WhatsApp, password, jenis kelamin, tanggal lahir, alamat > Daftar & Lanjut Check-in. Setelah berhasil, langsung masuk Beranda.",
    masuk: "Gunakan nomor WhatsApp dan password terdaftar di halaman Masuk Pasien.",
    ambilAntrean: "Beranda > Dokter Tersedia > cari dokter atau layanan > Konsul > dialog Konfirmasi Konsultasi > Ya, Ambil Antrean. Antrean dibuat untuk hari ini. Card dokter di chat: Pilih dokter membuka dialog yang sama; pasien tetap harus mengonfirmasi.",
    pantauAntrean: "Pasien boleh menunggu di rumah sambil memantau kartu Antrean Konsultasi di Beranda atau bertanya melalui chat. Segera berangkat ke klinik ketika sisa antrean mencapai 3 atau kurang; jangan menunggu sampai nomor dipanggil. Konsultasi tetap berlangsung di klinik. Perkiraan waktu bukan jadwal pasti.",
    perkiraanWaktu: "Sistem memakai rata-rata durasi konsultasi selesai untuk dokter yang sama (maksimal 30 konsultasi dalam 60 hari). Jika belum ada data valid, memakai 15 menit. Waktu tunggu adalah total rata-rata durasi pasien yang menunggu di depan ditambah sisa perkiraan konsultasi yang sedang berlangsung.",
    konsultasi: "Konsultasi dilakukan dengan dokter di klinik. Dokter mencatat diagnosis, tindakan, dan resep. Chat hanya membantu informasi dan pemilihan layanan, bukan sesi konsultasi medis.",
    bayar: "Setelah tagihan tersedia: Riwayat > pilih kunjungan > tab Invoice > Bayar > selesaikan pembayaran di Midtrans. Tombol Bayar juga dapat tampil pada kartu kunjungan di Beranda. Lunas hanya setelah sistem mengonfirmasi pembayaran.",
    obat: "Pantau status obat pada kartu di Beranda. Urutan: menunggu pembayaran > disiapkan > siap diambil > sudah diambil. Pembayaran yang dikonfirmasi sistem memindahkan obat ke disiapkan, BUKAN langsung siap diambil. Petugas farmasi menandai siap diambil setelah menyiapkan obat, lalu pasien mengambilnya di farmasi klinik. Pasien tidak perlu mengonfirmasi pembayaran atau mengubah status obat sendiri. Resep yang dicatat dokter dapat dilihat di Ringkasan Konsultasi pada Riwayat. Tidak ada tombol khusus bernama Pantau Proses Obat.",
    riwayat: "Riwayat > pilih kunjungan > tab Ringkasan Konsultasi atau Invoice untuk melihat detail kunjungan.",
    unduh: "Di detail Riwayat, pilih tab Invoice lalu Unduh Invoice PDF, atau tab Ringkasan Konsultasi lalu Unduh Ringkasan PDF. Dokumen hanya tersedia setelah datanya dibuat.",
    akun: "Akun menampilkan profil pasien dan tombol logout. Pengubahan profil, pembatalan antrean, reset password mandiri, dan pemesanan tanggal lain belum tersedia pada halaman pasien. Minta bantuan petugas untuk kebutuhan tersebut."
  },
  batasData: "Dokter aktif berarti terdaftar aktif di aplikasi, bukan jadwal praktik. Alamat klinik, jam buka, kontak CS, jadwal praktik, dan ketentuan BPJS belum tersedia. Jangan mengarang informasi tersebut. Untuk riwayat pasien, gunakan tool get_my_visit_history yang dapat mencari nomor kunjungan, rentang tanggal, dan mengambil halaman berikutnya."
};

export function getPatientAge(birthDate: Date, now = new Date()) {
  const jakartaParts = (date: Date) => Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(date).map(({ type, value }) => [type, Number(value)]));
  const today = jakartaParts(now);
  const birthday = jakartaParts(birthDate);
  let age = today.year - birthday.year;
  const birthdayNotReached = today.month < birthday.month
    || (today.month === birthday.month && today.day < birthday.day);
  if (birthdayNotReached) age -= 1;
  return age >= 0 ? age : null;
}

export async function loadAssistantContext(patientId: string) {
  const [patient, doctors] = await Promise.all([
    prisma.patient.findUnique({ where: { id: patientId }, select: { birthDate: true } }),
    prisma.doctor.findMany({ where: { isActive: true }, select: { specialization: true }, distinct: ["specialization"], orderBy: { specialization: "asc" } })
  ]);
  const patientAge = patient ? getPatientAge(patient.birthDate) : null;
  const specializations = doctors.map(({ specialization }) => specialization);
  return {
    patientAge,
    context: {
      klinik: clinicKnowledge,
      pasien: { usiaTahun: patientAge },
      katalogSpesialisasiDokter: specializations
    }
  };
}

export type AssistantContext = Awaited<ReturnType<typeof loadAssistantContext>>;
