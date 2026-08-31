-- Add queue fields used by registration check-in and dashboard queue ordering.
-- The IF NOT EXISTS guards make this migration safe for a local database that
-- already received these columns outside the checked-in migration history.
ALTER TABLE "Visit" ADD COLUMN IF NOT EXISTS "queueNumber" INTEGER;
ALTER TABLE "Visit" ADD COLUMN IF NOT EXISTS "queueDate" TIMESTAMP(3);

WITH numbered_visits AS (
    SELECT
        "id",
        date_trunc('day', "checkInTime")::timestamp(3) AS "nextQueueDate",
        row_number() OVER (
            PARTITION BY date_trunc('day', "checkInTime")
            ORDER BY "checkInTime", "createdAt", "id"
        ) AS "nextQueueNumber"
    FROM "Visit"
    WHERE "queueNumber" IS NULL OR "queueDate" IS NULL
)
UPDATE "Visit"
SET
    "queueDate" = numbered_visits."nextQueueDate",
    "queueNumber" = numbered_visits."nextQueueNumber"
FROM numbered_visits
WHERE "Visit"."id" = numbered_visits."id";

ALTER TABLE "Visit" ALTER COLUMN "queueNumber" SET NOT NULL;
ALTER TABLE "Visit" ALTER COLUMN "queueDate" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Visit_queueDate_queueNumber_key" ON "Visit"("queueDate", "queueNumber");
