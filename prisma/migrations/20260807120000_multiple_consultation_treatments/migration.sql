-- CreateTable
CREATE TABLE "ConsultationTreatment" (
    "id" TEXT NOT NULL,
    "consultationId" TEXT NOT NULL,
    "treatmentId" TEXT NOT NULL,
    "price" INTEGER NOT NULL,

    CONSTRAINT "ConsultationTreatment_pkey" PRIMARY KEY ("id")
);

-- Backfill existing single-treatment consultations into the new junction table.
INSERT INTO "ConsultationTreatment" ("id", "consultationId", "treatmentId", "price")
SELECT
    'ct_' || substr(md5(random()::text || clock_timestamp()::text), 1, 20),
    c."id",
    c."treatmentId",
    t."price"
FROM "Consultation" c
JOIN "Treatment" t ON t."id" = c."treatmentId";

-- DropForeignKey
ALTER TABLE "Consultation" DROP CONSTRAINT "Consultation_treatmentId_fkey";

-- DropColumn
ALTER TABLE "Consultation" DROP COLUMN "treatmentId";

-- AddForeignKey
ALTER TABLE "ConsultationTreatment" ADD CONSTRAINT "ConsultationTreatment_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationTreatment" ADD CONSTRAINT "ConsultationTreatment_treatmentId_fkey" FOREIGN KEY ("treatmentId") REFERENCES "Treatment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
