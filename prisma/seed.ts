import { PrismaClient, Gender, InvoiceStatus, Role, VisitStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import "dotenv/config";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL
});

const prisma = new PrismaClient({ adapter });

let randomSeed = 20260813;

function random() {
  randomSeed = (randomSeed * 1664525 + 1013904223) % 4294967296;
  return randomSeed / 4294967296;
}

function randomInt(min: number, max: number) {
  return Math.floor(random() * (max - min + 1)) + min;
}

function randomItem<T>(items: T[]) {
  return items[randomInt(0, items.length - 1)];
}

function pickMany<T>(items: T[], count: number) {
  const available = [...items];
  const selected: T[] = [];

  while (selected.length < count && available.length > 0) {
    const index = randomInt(0, available.length - 1);
    const [item] = available.splice(index, 1);
    selected.push(item);
  }

  return selected;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function formatDateCode(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function generateVisitNumberByDate(date: Date, counter: number) {
  return `VIS-${formatDateCode(date)}-${String(counter).padStart(4, "0")}`;
}

function generateInvoiceNumberByDate(date: Date, counter: number) {
  return `INV-${formatDateCode(date)}-${String(counter).padStart(4, "0")}`;
}

function createVisitDate(day: Date) {
  const hour = randomInt(8, 17);
  const minute = randomItem([0, 10, 15, 20, 30, 40, 45, 50]);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute);
}

function formatPatientName(index: number) {
  const firstNames = [
    "ADELIA",
    "BAYU",
    "CINDY",
    "DANI",
    "ELSA",
    "FIKRI",
    "GITA",
    "HAFIZ",
    "INDAH",
    "JOVAN",
    "KIRANA",
    "LUKMAN",
    "MAHARANI",
    "NANDO",
    "PRISKA",
    "RAIHAN",
    "SALSABILA",
    "TIO",
    "UTAMI",
    "WILDAN"
  ];
  const lastNames = [
    "PRATAMA",
    "SANTOSO",
    "NUGRAHA",
    "PERMATA",
    "RAMADHAN",
    "SAPUTRA",
    "KUSUMA",
    "LESTARI",
    "WIJAYA",
    "MAULANA",
    "HIDAYAT",
    "ANGGRAINI"
  ];

  return `${firstNames[index % firstNames.length]} ${lastNames[index % lastNames.length]} ${String(index).padStart(3, "0")}`;
}

async function main() {
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.consultationMedicine.deleteMany();
  await prisma.consultationTreatment.deleteMany();
  await prisma.consultation.deleteMany();
  await prisma.visit.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.doctor.deleteMany();
  await prisma.diagnosis.deleteMany();
  await prisma.treatment.deleteMany();
  await prisma.medicine.deleteMany();
  await prisma.user.deleteMany();

  const password = await bcrypt.hash("password123", 10);

  await prisma.user.createMany({
    data: [
      { name: "Admin Klinik", email: "admin@clinic.test", password, role: Role.ADMIN },
      { name: "Siti Staff", email: "staff@clinic.test", password, role: Role.STAFF },
      { name: "Dr. Andri", email: "doctor@clinic.test", password, role: Role.DOCTOR }
    ]
  });

  const doctors = await Promise.all([
    prisma.doctor.create({
      data: { name: "Dr. Andri Yunus Sp.PD", specialization: "Spesialis Penyakit Dalam", phone: "0812-1000-1101" }
    }),
    prisma.doctor.create({
      data: { name: "Dr. Rania Putri Sp.OG", specialization: "Spesialis Obstetri dan Ginekologi", phone: "0812-1000-1102" }
    }),
    prisma.doctor.create({
      data: { name: "Dr. Bima Pratama Sp.A", specialization: "Spesialis Anak", phone: "0812-1000-1103" }
    }),
    prisma.doctor.create({
      data: { name: "Dr. Nadira Salsabila Sp.JP", specialization: "Spesialis Jantung dan Pembuluh Darah", phone: "0812-1000-1104" }
    }),
    prisma.doctor.create({
      data: { name: "Dr. Reza Mahendra Sp.B", specialization: "Spesialis Bedah Umum", phone: "0812-1000-1105" }
    }),
    prisma.doctor.create({
      data: { name: "Dr. Sarah Amalia Sp.DV", specialization: "Spesialis Dermatologi dan Venereologi", phone: "0812-1000-1106" }
    }),
    prisma.doctor.create({
      data: { name: "Dr. Fajar Nugroho Sp.THT-KL", specialization: "Spesialis Telinga Hidung Tenggorokan", phone: "0812-1000-1107" }
    }),
    prisma.doctor.create({
      data: { name: "Dr. Citra Lestari Sp.M", specialization: "Spesialis Mata", phone: "0812-1000-1108" }
    }),
    prisma.doctor.create({
      data: { name: "Dr. Kevin Hartono Sp.N", specialization: "Spesialis Saraf", phone: "0812-1000-1109" }
    }),
    prisma.doctor.create({
      data: { name: "Dr. Maya Kirana Sp.KJ", specialization: "Spesialis Kedokteran Jiwa", phone: "0812-1000-1110" }
    })
  ]);

  await prisma.diagnosis.createMany({
    data: [
      { code: "A09", name: "Diare dan gastroenteritis" },
      { code: "E11", name: "Diabetes melitus tipe 2" },
      { code: "I10", name: "Hipertensi esensial" },
      { code: "J00", name: "Common cold / nasofaringitis akut" },
      { code: "J02", name: "Faringitis akut" },
      { code: "J06", name: "Infeksi saluran napas atas akut" },
      { code: "J45", name: "Asma" },
      { code: "K21", name: "GERD" },
      { code: "K30", name: "Dispepsia" },
      { code: "L20", name: "Dermatitis atopik" },
      { code: "M54", name: "Nyeri punggung" },
      { code: "N39", name: "Infeksi saluran kemih" },
      { code: "R05", name: "Batuk" },
      { code: "R50", name: "Demam" },
      { code: "R51", name: "Sakit kepala" }
    ]
  });

  await prisma.treatment.createMany({
    data: [
      { name: "Biaya konsultasi umum", price: 30000 },
      { name: "Biaya konsultasi dokter spesialis", price: 75000 },
      { name: "Nebulizer", price: 50000 },
      { name: "Perawatan luka ringan", price: 45000 },
      { name: "Perawatan luka sedang", price: 85000 },
      { name: "Injeksi intramuskular", price: 35000 },
      { name: "Pemeriksaan gula darah sewaktu", price: 25000 },
      { name: "Pemeriksaan tekanan darah", price: 15000 },
      { name: "Pemeriksaan kolesterol", price: 35000 },
      { name: "Pemeriksaan asam urat", price: 30000 },
      { name: "Tindakan irigasi telinga", price: 60000 },
      { name: "Pemasangan infus", price: 95000 }
    ]
  });

  await prisma.medicine.createMany({
    data: [
      { name: "Paracetamol 500mg", price: 5000, stock: 150 },
      { name: "Ibuprofen 400mg", price: 6500, stock: 120 },
      { name: "Amoxicillin 500mg", price: 8000, stock: 100 },
      { name: "Cetirizine 10mg", price: 4500, stock: 120 },
      { name: "Loratadine 10mg", price: 5000, stock: 100 },
      { name: "Ambroxol 30mg", price: 4500, stock: 110 },
      { name: "OBH Sirup 100ml", price: 18000, stock: 60 },
      { name: "Antacid Tablet", price: 4000, stock: 100 },
      { name: "Omeprazole 20mg", price: 7000, stock: 90 },
      { name: "Ranitidine 150mg", price: 6000, stock: 80 },
      { name: "Oralit Sachet", price: 2500, stock: 150 },
      { name: "Loperamide 2mg", price: 5000, stock: 70 },
      { name: "Metformin 500mg", price: 5500, stock: 100 },
      { name: "Amlodipine 5mg", price: 6000, stock: 100 },
      { name: "Salbutamol 2mg", price: 4500, stock: 90 },
      { name: "Hydrocortisone Cream 1%", price: 15000, stock: 50 },
      { name: "Povidone Iodine 30ml", price: 12000, stock: 70 },
      { name: "Vitamin C 500mg", price: 3000, stock: 150 }
    ]
  });

  const patientSeedData = [
    { name: "WONHEE KUSUMA", phone: "081366779876", gender: Gender.FEMALE, birthDate: "2006-06-28", address: "Jl. Gangnam 6 No. 15, Kec. Kebarusan, RT 7 RW 11, Seoul" },
    { name: "WINTER KIM MINJEONG", phone: "081299454471", gender: Gender.FEMALE, birthDate: "2001-01-01", address: "Jl. Gangnam 17 No. 5, RT 7 RW 08, Seoul" },
    { name: "SOFIA NURHALIZA", phone: "08938222394", gender: Gender.FEMALE, birthDate: "2010-03-14", address: "Jl. Jatimulya 05 No. 7, RT 2 RW 04, Bekasi" },
    { name: "BUDI SANTOSO", phone: "0812-0000-1111", gender: Gender.MALE, birthDate: "1995-04-10", address: "Jl. Merdeka No. 123, Jakarta" },
    { name: "SITI AISYAH", phone: "0812-0000-2222", gender: Gender.FEMALE, birthDate: "1998-01-20", address: "Jl. Melati No. 9, Jakarta" },
    { name: "RAKA ADITAMA", phone: "0812-0000-3333", gender: Gender.MALE, birthDate: "1990-11-11", address: "Jl. Sudirman No. 10, Jakarta" },
    { name: "NADIA PERMATA", phone: "0812-0000-4444", gender: Gender.FEMALE, birthDate: "1996-07-19", address: "Jl. Diponegoro No. 22, Bandung" },
    { name: "ARJUNA WIRATAMA", phone: "0812-0000-5555", gender: Gender.MALE, birthDate: "1988-09-03", address: "Jl. Pahlawan No. 8, Surabaya" },
    { name: "KARTIKA AYU", phone: "0812-0000-6666", gender: Gender.FEMALE, birthDate: "1992-12-25", address: "Jl. Cendrawasih No. 31, Yogyakarta" },
    { name: "DEWI LARASATI", phone: "0812-0000-6667", gender: Gender.FEMALE, birthDate: "1994-02-17", address: "Jl. Asia Afrika No. 17, Bandung" },
    { name: "FADHIL RAMADHAN", phone: "0812-0000-6668", gender: Gender.MALE, birthDate: "1989-08-21", address: "Jl. Ahmad Yani No. 45, Semarang" },
    { name: "NURUL HIKMAH", phone: "0812-0000-6669", gender: Gender.FEMALE, birthDate: "2000-05-09", address: "Jl. Imam Bonjol No. 12, Depok" },
    { name: "GALANG PRAYOGA", phone: "0812-0000-6670", gender: Gender.MALE, birthDate: "1993-10-30", address: "Jl. Gatot Subroto No. 28, Jakarta Selatan" },
    { name: "ANISA MAHARANI", phone: "0812-0000-6671", gender: Gender.FEMALE, birthDate: "1997-04-03", address: "Jl. Kenanga No. 6, Bogor" },
    { name: "YOGA SAPUTRA", phone: "0812-0000-6672", gender: Gender.MALE, birthDate: "1985-01-15", address: "Jl. Pemuda No. 40, Semarang" },
    { name: "MELATI PRAMESWARI", phone: "0812-0000-6673", gender: Gender.FEMALE, birthDate: "2003-09-27", address: "Jl. Mawar No. 18, Malang" },
    { name: "HENDRA WIJAYA", phone: "0812-0000-6674", gender: Gender.MALE, birthDate: "1979-12-02", address: "Jl. Veteran No. 71, Surakarta" },
    { name: "PUTRI AMELIA", phone: "0812-0000-6675", gender: Gender.FEMALE, birthDate: "1999-06-06", address: "Jl. Cikini Raya No. 9, Jakarta Pusat" },
    { name: "DANIEL KURNIAWAN", phone: "0812-0000-6676", gender: Gender.MALE, birthDate: "1991-03-22", address: "Jl. Gajah Mada No. 37, Denpasar" },
    { name: "LAILA FITRIANI", phone: "0812-0000-6677", gender: Gender.FEMALE, birthDate: "1987-07-11", address: "Jl. Dipati Ukur No. 24, Bandung" },
    { name: "IRFAN MAULANA", phone: "0812-0000-6678", gender: Gender.MALE, birthDate: "1996-11-05", address: "Jl. Margonda Raya No. 102, Depok" },
    { name: "TANIA CARISSA", phone: "0812-0000-6679", gender: Gender.FEMALE, birthDate: "2002-02-26", address: "Jl. Kaliurang Km 7, Sleman" },
    { name: "BAGAS PRANATA", phone: "0812-0000-6680", gender: Gender.MALE, birthDate: "1994-09-16", address: "Jl. MT Haryono No. 53, Balikpapan" },
    { name: "RATNA PUSPITA", phone: "0812-0000-6681", gender: Gender.FEMALE, birthDate: "1983-05-31", address: "Jl. Teuku Umar No. 20, Denpasar" },
    { name: "ALDI FIRMANSYAH", phone: "0812-0000-6682", gender: Gender.MALE, birthDate: "2001-08-08", address: "Jl. Pangeran Antasari No. 11, Banjarmasin" },
    { name: "MEGA SAFITRI", phone: "0812-0000-6683", gender: Gender.FEMALE, birthDate: "1990-04-18", address: "Jl. Sisingamangaraja No. 19, Medan" },
    { name: "RIZKY MAHARDIKA", phone: "0812-0000-6684", gender: Gender.MALE, birthDate: "1998-12-09", address: "Jl. HOS Cokroaminoto No. 8, Tangerang" },
    { name: "CLARA ANGELINA", phone: "0812-0000-6685", gender: Gender.FEMALE, birthDate: "1995-10-13", address: "Jl. Dr. Sutomo No. 14, Makassar" },
    { name: "FAJRI HIDAYAT", phone: "0812-0000-6686", gender: Gender.MALE, birthDate: "1986-02-01", address: "Jl. Sultan Agung No. 33, Bekasi" },
    { name: "INTAN PERMATASARI", phone: "0812-0000-6687", gender: Gender.FEMALE, birthDate: "1993-06-24", address: "Jl. Raden Saleh No. 5, Jakarta Pusat" },
    { name: "ADITYA NUGRAHA", phone: "0812-0000-6688", gender: Gender.MALE, birthDate: "1982-03-07", address: "Jl. Mayjen Sungkono No. 88, Surabaya" },
    { name: "SEKAR WULANDARI", phone: "0812-0000-6689", gender: Gender.FEMALE, birthDate: "2004-01-29", address: "Jl. Panembahan Senopati No. 16, Yogyakarta" },
    { name: "MARIO SETIAWAN", phone: "0812-0000-6690", gender: Gender.MALE, birthDate: "1997-07-04", address: "Jl. Basuki Rahmat No. 61, Malang" },
    { name: "AISHA RAHMAN", phone: "0812-0000-6691", gender: Gender.FEMALE, birthDate: "1991-09-14", address: "Jl. KH Wahid Hasyim No. 29, Jakarta" },
    { name: "DION PRATAMA", phone: "0812-0000-6692", gender: Gender.MALE, birthDate: "2000-10-01", address: "Jl. Cihampelas No. 70, Bandung" },
    { name: "VINA APRILIA", phone: "0812-0000-6693", gender: Gender.FEMALE, birthDate: "1989-11-23", address: "Jl. Letjen S. Parman No. 22, Pontianak" },
    { name: "KHAIRUL ANWAR", phone: "0812-0000-6694", gender: Gender.MALE, birthDate: "1978-06-12", address: "Jl. Cut Nyak Dien No. 13, Banda Aceh" },
    { name: "OLIVIA PUTRI", phone: "0812-0000-6695", gender: Gender.FEMALE, birthDate: "2005-04-20", address: "Jl. Pajajaran No. 64, Bogor" },
    { name: "GILANG RAMADHAN", phone: "0812-0000-6696", gender: Gender.MALE, birthDate: "1992-08-17", address: "Jl. Diponegoro No. 41, Solo" },
    { name: "MONICA SANTIKA", phone: "0812-0000-6697", gender: Gender.FEMALE, birthDate: "1988-12-28", address: "Jl. Merbabu No. 10, Semarang" },
    { name: "RENDY SAPUTRA", phone: "0812-0000-6698", gender: Gender.MALE, birthDate: "1996-05-25", address: "Jl. Kertajaya No. 77, Surabaya" },
    { name: "SARAH NABILA", phone: "0812-0000-6699", gender: Gender.FEMALE, birthDate: "1999-02-10", address: "Jl. Prof. Dr. Hamka No. 3, Padang" },
    { name: "DIMAS WICAKSONO", phone: "0812-0000-6700", gender: Gender.MALE, birthDate: "1984-09-06", address: "Jl. Sam Ratulangi No. 25, Manado" },
    { name: "MIRA KARTIKA", phone: "0812-0000-6701", gender: Gender.FEMALE, birthDate: "1994-03-19", address: "Jl. Riau No. 31, Pekanbaru" },
    { name: "OSCAR WILLIAM", phone: "0812-0000-6702", gender: Gender.MALE, birthDate: "1990-01-08", address: "Jl. Boulevard Raya No. 12, Jakarta Utara" },
    { name: "NIA FEBRIANTI", phone: "0812-0000-6703", gender: Gender.FEMALE, birthDate: "2002-11-18", address: "Jl. Ahmad Dahlan No. 44, Cirebon" },
    { name: "TOMMY HERMAWAN", phone: "0812-0000-6704", gender: Gender.MALE, birthDate: "1987-04-27", address: "Jl. Hasanuddin No. 55, Makassar" },
    { name: "ZAHRA KAMILA", phone: "0812-0000-6705", gender: Gender.FEMALE, birthDate: "1998-07-30", address: "Jl. Sultan Hasanuddin No. 21, Palu" },
    { name: "YUSUF ALFARIZI", phone: "0812-0000-6706", gender: Gender.MALE, birthDate: "1993-12-04", address: "Jl. Pattimura No. 7, Ambon" }
  ];

  const cities = ["Jakarta", "Bandung", "Bekasi", "Depok", "Bogor", "Semarang", "Surabaya", "Yogyakarta", "Malang", "Tangerang"];
  const extraPatientSeedData = Array.from({ length: 101 }, (_, index) => {
    const patientNumber = index + patientSeedData.length + 1;
    const gender = patientNumber % 2 === 0 ? Gender.MALE : Gender.FEMALE;
    const birthYear = randomInt(1974, 2010);
    const birthMonth = randomInt(1, 12);
    const birthDay = randomInt(1, 28);

    return {
      name: formatPatientName(patientNumber),
      phone: `0813-2026-${String(patientNumber).padStart(4, "0")}`,
      gender,
      birthDate: `${birthYear}-${String(birthMonth).padStart(2, "0")}-${String(birthDay).padStart(2, "0")}`,
      address: `Jl. Simulasi Klinik No. ${patientNumber}, ${randomItem(cities)}`
    };
  });

  const patients = await Promise.all(
    [...patientSeedData, ...extraPatientSeedData].map((patient) =>
      prisma.patient.create({
        data: {
          ...patient,
          birthDate: new Date(patient.birthDate)
        }
      })
    )
  );

  await prisma.medicine.updateMany({ data: { stock: 500 } });

  const [diagnoses, treatments, medicines] = await Promise.all([
    prisma.diagnosis.findMany(),
    prisma.treatment.findMany(),
    prisma.medicine.findMany()
  ]);

  const complaints = [
    "Demam dan badan terasa lemas",
    "Batuk pilek sejak beberapa hari",
    "Nyeri perut dan mual",
    "Kontrol tekanan darah",
    "Sakit kepala berulang",
    "Keluhan alergi kulit",
    "Sesak napas ringan",
    "Nyeri tenggorokan",
    "Pemeriksaan kesehatan rutin",
    "Luka ringan setelah aktivitas"
  ];
  const notes = [
    "Disarankan istirahat cukup dan kontrol bila keluhan berlanjut.",
    "Pasien diberi edukasi penggunaan obat sesuai aturan.",
    "Kondisi umum stabil, tidak ditemukan tanda bahaya.",
    "Perlu evaluasi ulang bila gejala memberat.",
    "Follow up sesuai kebutuhan klinis."
  ];

  let visitCounter = 1;
  let invoiceCounter = 1;
  const today = startOfDay(new Date());

  for (let dayOffset = -179; dayOffset <= 0; dayOffset += 1) {
    const day = addDays(today, dayOffset);
    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
    const isToday = dayOffset === 0;
    const dailyVisitTarget = isToday ? randomInt(8, 14) : isWeekend ? randomInt(3, 7) : randomInt(6, 13);

    for (let dailyIndex = 0; dailyIndex < dailyVisitTarget; dailyIndex += 1) {
      const checkInTime = createVisitDate(day);
      const statusRoll = random();
      const status = isToday
        ? statusRoll < 0.45
          ? VisitStatus.WAITING
          : statusRoll < 0.7
            ? VisitStatus.IN_CONSULTATION
            : statusRoll < 0.92
              ? VisitStatus.COMPLETED
              : VisitStatus.CANCELLED
        : statusRoll < 0.88
          ? VisitStatus.COMPLETED
          : VisitStatus.CANCELLED;

      const visit = await prisma.visit.create({
        data: {
          visitNumber: generateVisitNumberByDate(checkInTime, visitCounter),
          patientId: randomItem(patients).id,
          doctorId: randomItem(doctors).id,
          status,
          checkInTime,
          createdAt: checkInTime
        }
      });

      visitCounter += 1;

      if (status !== VisitStatus.COMPLETED) {
        continue;
      }

      const consultationTime = addMinutes(checkInTime, randomInt(20, 90));
      const selectedTreatments = pickMany(treatments, randomInt(1, 3));
      const selectedMedicines = pickMany(medicines, randomInt(1, 3)).map((medicine) => ({
        ...medicine,
        quantity: randomInt(1, 4)
      }));

      await prisma.consultation.create({
        data: {
          visitId: visit.id,
          complaint: randomItem(complaints),
          notes: randomItem(notes),
          diagnosisId: randomItem(diagnoses).id,
          createdAt: consultationTime,
          treatments: {
            create: selectedTreatments.map((treatment) => ({
              treatmentId: treatment.id,
              price: treatment.price
            }))
          },
          medicines: {
            create: selectedMedicines.map((medicine) => ({
              medicineId: medicine.id,
              quantity: medicine.quantity,
              price: medicine.price
            }))
          }
        }
      });

      const invoiceCreatedAt = addMinutes(consultationTime, randomInt(5, 25));
      const invoiceItems = [
        ...selectedTreatments.map((treatment) => ({
          item: treatment.name,
          quantity: 1,
          price: treatment.price,
          amount: treatment.price
        })),
        ...selectedMedicines.map((medicine) => ({
          item: medicine.name,
          quantity: medicine.quantity,
          price: medicine.price,
          amount: medicine.price * medicine.quantity
        }))
      ];
      const total = invoiceItems.reduce((sum, item) => sum + item.amount, 0);
      const isPaid = random() < 0.78;
      const paidAt = isPaid ? addMinutes(invoiceCreatedAt, randomInt(10, 60 * 48)) : null;

      await prisma.invoice.create({
        data: {
          invoiceNo: generateInvoiceNumberByDate(invoiceCreatedAt, invoiceCounter),
          visitId: visit.id,
          status: isPaid ? InvoiceStatus.PAID : InvoiceStatus.UNPAID,
          total,
          paidAt,
          createdAt: invoiceCreatedAt,
          items: {
            create: invoiceItems
          }
        }
      });

      invoiceCounter += 1;
    }
  }

  console.log(`Seed selesai: ${patients.length} pasien, ${visitCounter - 1} kunjungan, ${invoiceCounter - 1} invoice.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
