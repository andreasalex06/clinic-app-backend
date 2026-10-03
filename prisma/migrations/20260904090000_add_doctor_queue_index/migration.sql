CREATE SEQUENCE "Doctor_queueIndex_seq";

ALTER TABLE "Doctor" ADD COLUMN "queueIndex" INTEGER;

WITH ordered_doctors AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (ORDER BY "createdAt", "id")::INTEGER AS "nextQueueIndex"
  FROM "Doctor"
)
UPDATE "Doctor"
SET "queueIndex" = ordered_doctors."nextQueueIndex"
FROM ordered_doctors
WHERE "Doctor"."id" = ordered_doctors."id";

SELECT setval(
  '"Doctor_queueIndex_seq"',
  GREATEST(COALESCE((SELECT MAX("queueIndex") FROM "Doctor"), 0) + 1, 1),
  false
);

ALTER SEQUENCE "Doctor_queueIndex_seq" OWNED BY "Doctor"."queueIndex";
ALTER TABLE "Doctor" ALTER COLUMN "queueIndex" SET DEFAULT nextval('"Doctor_queueIndex_seq"');
ALTER TABLE "Doctor" ALTER COLUMN "queueIndex" SET NOT NULL;

CREATE UNIQUE INDEX "Doctor_queueIndex_key" ON "Doctor"("queueIndex");

DROP INDEX "Visit_queueDate_queueNumber_key";
CREATE UNIQUE INDEX "Visit_queueDate_doctorId_queueNumber_key"
ON "Visit"("queueDate", "doctorId", "queueNumber");
