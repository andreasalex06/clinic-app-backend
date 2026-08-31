ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "midtransOrderId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "midtransToken" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "midtransRedirectUrl" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "midtransTransactionStatus" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "midtransPaymentType" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_midtransOrderId_key" ON "Invoice"("midtransOrderId");
