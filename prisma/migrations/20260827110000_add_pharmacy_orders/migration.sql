CREATE TYPE "PharmacyStatus" AS ENUM ('WAITING_PAYMENT', 'PREPARING', 'READY_FOR_PICKUP', 'COMPLETED');

CREATE TABLE "PharmacyOrder" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "queueNumber" INTEGER,
    "queueDate" TIMESTAMP(3),
    "status" "PharmacyStatus" NOT NULL DEFAULT 'WAITING_PAYMENT',
    "preparedAt" TIMESTAMP(3),
    "readyAt" TIMESTAMP(3),
    "pickedUpAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PharmacyOrder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PharmacyOrder_visitId_key" ON "PharmacyOrder"("visitId");
CREATE UNIQUE INDEX "PharmacyOrder_queueDate_queueNumber_key" ON "PharmacyOrder"("queueDate", "queueNumber");

ALTER TABLE "PharmacyOrder" ADD CONSTRAINT "PharmacyOrder_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
