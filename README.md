# Clinic Backend

## Setup

1. Copy `.env.example` to `.env`.
2. Set `DATABASE_URL` for PostgreSQL.
3. Install dependencies:

```bash
npm install
```

4. Run Prisma:

```bash
npm run prisma:migrate
npm run prisma:seed
```

5. Start API:

```bash
npm run dev
```

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
