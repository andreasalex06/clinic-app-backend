# ClinicApp Backend

API bersama untuk dashboard petugas dan web pasien. Menggunakan Express, TypeScript, PostgreSQL, Prisma, JWT, Socket.IO, dan Midtrans Snap Sandbox.

## Struktur dan urutan startup

```text
clinic-app-mobileuserfirst/
  dashboard/
    backend/             API dan Socket.IO :5050
    frontend/            Dashboard petugas :5173
  user-side-frontend/    Web pasien        :5174
```

Jalankan PostgreSQL terlebih dahulu, kemudian backend, dashboard, dan web pasien di terminal terpisah. Ketiga folder aplikasi merupakan repository Git terpisah; jalankan npm/Git dari folder aplikasi yang sesuai, bukan folder induk.

Panduan terkait: [Dashboard frontend](../frontend/README.md) dan [User-side frontend](../../user-side-frontend/README.md).

## Prasyarat

- Node.js 22 versi 22.12 atau lebih baru dalam major 22, atau Node.js 24; npm bawaan Node.js. Rentang ini sesuai persyaratan Prisma/Vite pada lockfile project.
- PostgreSQL berjalan dan tersedia database development khusus project.
- Akun Midtrans Sandbox dan ngrok hanya diperlukan untuk simulasi pembayaran.
- Contoh perintah menggunakan PowerShell. `psql` harus ada di PATH jika menggunakan contoh pembuatan database melalui terminal; pgAdmin juga dapat digunakan.

```powershell
node --version
npm --version
```

## Instalasi pertama

### 1. Pasang dependensi

Dari folder induk `clinic-app-mobileuserfirst`:

```powershell
cd dashboard/backend
npm ci
```

`npm ci` memasang versi dari `package-lock.json`. Gunakan npm secara konsisten; jangan mencampur lockfile package manager lain.

### 2. Konfigurasi environment

Jika `.env` belum ada, salin template tanpa menimpa konfigurasi yang sudah ada:

```powershell
if (!(Test-Path .env)) { Copy-Item .env.example .env }
```

Lengkapi `.env` dengan contoh berikut. Template `.env.example` saat ini belum mencantumkan seluruh variabel user-side dan Midtrans.

```dotenv
DATABASE_URL="postgresql://postgres:YOUR_DB_PASSWORD@localhost:5432/clinic_app?schema=public"
PORT=5050
JWT_SECRET="replace-with-a-long-random-local-secret"
JWT_EXPIRES_IN="1d"
FRONTEND_URL="http://localhost:5173"
USER_FRONTEND_URL="http://localhost:5174"
MIDTRANS_SERVER_KEY=""
MIDTRANS_CLIENT_KEY=""
MIDTRANS_IS_PRODUCTION=false
```

| Variabel | Fungsi |
| --- | --- |
| `DATABASE_URL` | Koneksi PostgreSQL; sesuaikan user, password, host, port, dan nama database. Encode karakter khusus password untuk URL. |
| `PORT` | Port HTTP API sekaligus Socket.IO. Tetapkan `5050`; default kode jika dihilangkan adalah `5000`. |
| `JWT_SECRET` | Penandatangan token login; minimal 8 karakter menurut validasi kode. Gunakan secret acak, bukan contoh di atas. |
| `JWT_EXPIRES_IN` | Masa berlaku token, contoh `1d`. |
| `FRONTEND_URL` | Origin dashboard yang diizinkan CORS. |
| `USER_FRONTEND_URL` | Origin pasien untuk CORS HTTP/Socket.IO dan dasar finish URL pembayaran. |
| `MIDTRANS_SERVER_KEY` | Kunci rahasia backend untuk membuat transaksi dan memverifikasi notifikasi. |
| `MIDTRANS_CLIENT_KEY` | Kunci yang diberikan ke frontend untuk memuat Snap. Bukan Server Key. |
| `MIDTRANS_IS_PRODUCTION` | Tetap `false` untuk project simulasi ini. |

Gunakan origin tanpa path atau slash penutup. `localhost` dan `127.0.0.1` adalah origin berbeda. Jika port/host frontend berubah, sesuaikan origin di atas dan restart backend.

Kunci Midtrans boleh kosong untuk fitur non-payment; endpoint pembayaran akan menolak sampai kunci diisi. Jangan commit `.env`, membagikan Server Key, atau memasukkannya ke variabel `VITE_*`. Ganti kunci yang pernah terekspos.

### 3. Siapkan database dan Prisma

Buat database development kosong jika belum ada, misalnya melalui pgAdmin atau:

```powershell
psql -h localhost -U postgres -c 'CREATE DATABASE clinic_app;'
```

Lewati pembuatan jika database tersebut sudah ada. Dari folder backend, terapkan migrasi repository dan buat Prisma Client:

```powershell
npx prisma migrate deploy
npm run prisma:generate
```

`migrate deploy` menerapkan file migrasi yang tersedia, bukan membuat migrasi baru. `prisma:generate` membuat client yang digunakan kode TypeScript. Jalankan generate secara eksplisit setelah migrasi/perubahan schema.

Untuk pengembangan schema baru tersedia `npm run prisma:migrate` (`prisma migrate dev`); ini bukan langkah startup rutin. Gunakan hanya pada database development. Jika Prisma meminta reset karena drift, jangan menyetujuinya pada database penting; periksa riwayat migrasi dan backup dahulu. Jangan memakai `db push` atau `migrate reset` sebagai solusi otomatis untuk error migrasi.

### 4. Data demo (opsional dan destruktif)

> PERINGATAN: `npm run prisma:seed` menghapus data klinik yang ada, termasuk pasien, kunjungan, konsultasi, invoice, farmasi, master data, dan user, lalu membuat data demo. Jalankan hanya pada database development yang boleh dikosongkan. Bukan perintah startup harian.

Setelah memastikan target `DATABASE_URL` benar dan tidak menyimpan data penting:

```powershell
npm run prisma:seed
```

Seed menyediakan master dokter, tindakan, obat, dan akun dashboard:

| Role | Email | Password demo |
| --- | --- | --- |
| Admin | `admin@clinic.test` | `password123` |
| Staff | `staff@clinic.test` | `password123` |
| Doctor | `doctor@clinic.test` | `password123` |

Akun tersebut hanya dapat diasumsikan tersedia setelah seed berhasil pada database yang sedang digunakan. Password pasien demo pada seed adalah `patient123`; untuk demo pasien yang bersih, daftar akun baru dari web pasien. Jangan gunakan kredensial demo untuk production.

### 5. Jalankan backend

```powershell
npm run dev
```

API: [http://localhost:5050/api](http://localhost:5050/api). Pada terminal lain, periksa server:

```powershell
Invoke-RestMethod http://localhost:5050/api/test
```

Respons yang diharapkan: `{"message":"Clinic API is running"}`. Endpoint ini hanya memeriksa server HTTP, bukan koneksi database atau pembayaran. Gunakan login dan alur klinik untuk memeriksa integrasi database.

Biarkan backend berjalan dan jalankan kedua frontend sesuai README masing-masing. Hentikan server development dengan `Ctrl+C`.

## Menjalankan kembali

Pastikan PostgreSQL aktif, lalu dari folder backend jalankan `npm run dev`. Tidak perlu migrasi/seed setiap startup. Jika dependency berubah, jalankan `npm ci`; jika ada migrasi baru, terapkan migrasi dan generate client sebelum restart.

## Midtrans Sandbox dan ngrok

### Kunci dan webhook

1. Masuk ke dashboard Midtrans dalam environment **Sandbox**, lalu buka Access Keys.
2. Salin Server Key ke `MIDTRANS_SERVER_KEY` dan Client Key ke `MIDTRANS_CLIENT_KEY`, persis seperti yang ditampilkan. Jangan menambah/menghapus awalan kunci secara manual atau menggunakan key production.
3. Pastikan `MIDTRANS_IS_PRODUCTION=false`, lalu restart backend.
4. Pasang ngrok dan hubungkan akun menggunakan authtoken pribadi sesuai petunjuk dashboard ngrok. Jangan membagikan authtoken.
5. Dengan backend tetap berjalan, buka terminal tambahan:

```powershell
ngrok http 5050
```

Gunakan URL HTTPS **Forwarding** yang ditampilkan ngrok. Isi Payment Notification URL pada pengaturan payment Midtrans dengan pola berikut (ganti host contoh):

```text
https://YOUR-NGROK-HOST/api/public/midtrans/notification
```

Tes URL notifikasi, lalu simpan. Tetap jalankan backend dan ngrok selama pengujian. Jika URL tunnel berubah, perbarui URL notifikasi. Ngrok diarahkan ke backend, bukan frontend. Frontend lokal tetap dapat menggunakan `http://localhost:5050/api`.

Webhook memakai `POST` dengan JSON dan signature Midtrans, bukan JWT pasien. Membuka URL melalui address bar browser mengirim `GET` dan bukan tes webhook yang valid. Handler menerima probe dashboard sandbox khusus hanya setelah signature valid; probe sukses belum membuktikan pembayaran invoice berhasil.

Lihat [dokumentasi webhook Midtrans](https://docs.midtrans.com/docs/https-notification-webhooks) untuk kebutuhan URL publik dan verifikasi notifikasi.

### Simulasi dari aplikasi

1. Daftar/login pasien di user-side, lalu buat konsultasi/check-in.
2. Di dashboard petugas, proses kunjungan dan simpan konsultasi dengan tindakan; sertakan obat jika ingin menguji farmasi. Invoice dibuat otomatis.
3. Di user-side, buka detail Riwayat lalu bayar. Untuk invoice dengan resep yang masih menunggu pembayaran, tombol tersedia juga pada Antrean > Farmasi > Live Tracking.
4. Pilih metode yang tersedia di Snap. Contoh: BCA Virtual Account, lalu catat nomor VA sandbox.
5. Selesaikan simulasi menggunakan [simulator BCA VA](https://simulator.sandbox.midtrans.com/bca/va/index), bukan transfer uang asli. Ikuti [panduan sandbox](https://docs.midtrans.com/docs/testing-payment-on-sandbox) untuk metode lain.
6. Periksa transaksi Midtrans dan invoice aplikasi. Setelah webhook valid diproses, invoice menjadi `PAID`; farmasi yang menunggu pembayaran menjadi `PREPARING` dan mendapatkan nomor antrean obat.

```text
Tombol Bayar -> POST /api/public/invoices/:invoiceId/midtrans
Backend validasi pasien/invoice -> Midtrans membuat Snap token
Frontend snap.pay(token) -> pasien menyelesaikan simulasi
Midtrans POST webhook -> verifikasi signature -> update database
Socket.IO pharmacy:changed -> frontend GET /api/public/pharmacy/active
```

Callback popup hanya meminta frontend refresh; bukan sumber kebenaran status lunas. Tracking farmasi juga polling tiap 5 detik. Jika webhook gagal, polling tidak dapat membuat invoice lunas sendiri. Riwayat belum memiliki polling yang sama, sehingga dapat memerlukan refresh jika webhook datang setelah callback popup.

### Batasan simulasi

- Frontend memuat script Snap sandbox secara tetap; mengganti flag backend saja tidak cukup untuk production.
- Pembayaran ulang masih membuat transaksi memakai order ID lama, belum menggunakan kembali token tersimpan; dapat mengalami error order ID sudah digunakan. Untuk demo, selesaikan transaksi sandbox yang sudah ada melalui simulator atau gunakan kunjungan/invoice baru. Jangan mengubah status database secara manual untuk menyamarkan error.
- Pencocokan nominal, pemeriksaan `fraud_status`, serta penanganan notifikasi berulang dan konkurensi antrean perlu diperkuat sebelum production.

## Build dan pengujian

Jalankan dari folder backend:

```powershell
npm run typecheck
npm run build
node --import tsx --test tests/midtrans-notification.test.cjs
```

Tes webhook menggunakan konfigurasi uji dan stub akses invoice; bukan tes pembayaran end-to-end atau pembuktian koneksi database. Untuk menjalankan hasil kompilasi:

```powershell
npm start
```

`npm start` membutuhkan `dist/` hasil build, `.env`, PostgreSQL, dan migrasi yang sesuai. Jangan menjalankannya bersamaan dengan dev server pada port yang sama. Build berhasil tidak berarti konfigurasi sudah aman untuk production.

## Troubleshooting

| Gejala | Pemeriksaan |
| --- | --- |
| Tidak bisa konek PostgreSQL | Pastikan service aktif, host/port benar, database ada, dan kredensial `DATABASE_URL` sesuai. |
| Tabel/kolom tidak ditemukan, termasuk kolom Midtrans | Periksa target database, jalankan `npx prisma migrate status`, terapkan migrasi repository, generate client, dan restart. Jangan langsung reset. |
| `EADDRINUSE` | Port dipakai proses lain. Gunakan server yang sudah berjalan jika benar project ini, atau ubah `PORT` beserta URL API kedua frontend dan target ngrok. |
| CORS atau Socket.IO gagal | Samakan origin frontend dengan `FRONTEND_URL`/`USER_FRONTEND_URL`, termasuk host dan port; restart backend. |
| Login demo gagal | Akun seed belum tentu ada pada database aktif. Periksa data; jangan seed database penting hanya untuk memperbaiki login. |
| Midtrans tidak terkonfigurasi / autentikasi gagal | Periksa pasangan Sandbox Server Key dan Client Key, flag false, lalu restart backend. |
| Tes notifikasi gagal | Periksa tunnel menuju 5050, URL lengkap, log backend, dan inspector ngrok yang ditampilkan terminal (biasanya `http://127.0.0.1:4040`). |
| Webhook `401` / `404` / `500` | `401`: signature/key tidak cocok; `404`: route atau invoice tidak ditemukan; `500`: lihat log backend, konfigurasi, dan migrasi. Jangan menonaktifkan verifikasi signature. |
| Popup sukses tetapi belum lunas | Periksa pengiriman webhook dan respons backend; callback popup saja tidak memperbarui database. |

## Lokasi kode penting

- [Environment](src/config/env.ts), [Prisma schema](prisma/schema.prisma), dan [seed](prisma/seed.ts).
- [Public routes](src/modules/public/public.routes.ts) dan [controller payment/webhook](src/modules/public/public.controller.ts).
- [Pembuatan konsultasi dan invoice](src/modules/consultations/consultation.controller.ts).
- [Autentikasi socket dan event pasien](src/socket.ts).
