DROP INDEX "Visit_queueDate_doctorId_queueNumber_key";

WITH numbered_visits AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "queueDate", "doctorId"
      ORDER BY "queueNumber", "checkInTime", "createdAt", "id"
    )::INTEGER AS "nextQueueNumber"
  FROM "Visit"
)
UPDATE "Visit"
SET "queueNumber" = numbered_visits."nextQueueNumber"
FROM numbered_visits
WHERE "Visit"."id" = numbered_visits."id";

CREATE UNIQUE INDEX "Visit_queueDate_doctorId_queueNumber_key"
ON "Visit"("queueDate", "doctorId", "queueNumber");
