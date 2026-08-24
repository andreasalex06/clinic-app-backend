# Clinic Backend

Backend API untuk Clinic App. Stack: Express, TypeScript, Prisma, PostgreSQL, dan JWT Auth.

## Requirements

- Node.js
- PostgreSQL
- npm

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy environment file:

```bash
cp .env.example .env
```

Di Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

3. Set database URL di `.env`:

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/clinic_app"
JWT_SECRET="your-secret-key"
PORT=5050
```

4. Generate Prisma client:

```bash
npm run prisma:generate
```

5. Run migration:

```bash
npm run prisma:migrate
```

6. Seed initial data:

```bash
npm run prisma:seed
```

7. Start development server:

```bash
npm run dev
```

API akan berjalan di:

```txt
http://localhost:5050
```

Base API:

```txt
http://localhost:5050/api
```

## Check API

Buka browser atau Postman:

```txt
GET http://localhost:5050/api/test
```

Jika berhasil, API sudah berjalan.

## Seed Users

```txt
admin@clinic.test  / password123
staff@clinic.test  / password123
doctor@clinic.test / password123
```

## Main Flow

```txt
Login -> Patient registration -> Visit/check-in -> Queue -> Consultation -> Invoice -> Paid
```

## Useful Scripts

```bash
npm run dev
npm run build
npm start
npm run typecheck
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

## Troubleshooting

### Login gagal

Pastikan seed sudah dijalankan:

```bash
npm run prisma:seed
```

Gunakan akun seed yang tersedia di bagian `Seed Users`.

### Database connection error

Pastikan PostgreSQL berjalan dan `DATABASE_URL` di `.env` sudah benar.

### Prisma client error

Jalankan ulang:

```bash
npm run prisma:generate
```
