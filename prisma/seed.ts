import { PrismaClient, Gender, Role, VisitStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import "dotenv/config";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL
});

const prisma = new PrismaClient({ adapter });

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

  const patients = await Promise.all(
    patientSeedData.map((patient) =>
      prisma.patient.create({
        data: {
          ...patient,
          birthDate: new Date(patient.birthDate)
        }
      })
    )
  );

  await prisma.visit.createMany({
    data: [
      {
        visitNumber: "VIS-20260807-0001",
        patientId: patients[0].id,
        doctorId: doctors[5].id,
        status: VisitStatus.COMPLETED
      },
      {
        visitNumber: "VIS-20260807-0002",
        patientId: patients[1].id,
        doctorId: doctors[1].id,
        status: VisitStatus.WAITING
      },
      {
        visitNumber: "VIS-20260807-0003",
        patientId: patients[2].id,
        doctorId: doctors[2].id,
        status: VisitStatus.IN_CONSULTATION
      },
      {
        visitNumber: "VIS-20260807-0004",
        patientId: patients[3].id,
        doctorId: doctors[0].id,
        status: VisitStatus.WAITING
      },
      {
        visitNumber: "VIS-20260807-0005",
        patientId: patients[4].id,
        doctorId: doctors[3].id,
        status: VisitStatus.WAITING
      },
      {
        visitNumber: "VIS-20260807-0006",
        patientId: patients[5].id,
        doctorId: doctors[4].id,
        status: VisitStatus.COMPLETED
      },
      {
        visitNumber: "VIS-20260807-0007",
        patientId: patients[6].id,
        doctorId: doctors[6].id,
        status: VisitStatus.CANCELLED
      }
    ]
  });
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
