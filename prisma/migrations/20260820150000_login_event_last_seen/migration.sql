-- AlterTable
ALTER TABLE "LoginEvent" ADD COLUMN     "lastSeenAt" TIMESTAMP(3);

-- Backfill: voor al bestaande rijen (aangemaakt vóór activiteit-gebaseerd
-- bijhouden) is het aanmaakmoment de beste beschikbare benadering.
UPDATE "LoginEvent" SET "lastSeenAt" = "createdAt" WHERE "lastSeenAt" IS NULL;

ALTER TABLE "LoginEvent" ALTER COLUMN "lastSeenAt" SET NOT NULL,
ALTER COLUMN "lastSeenAt" SET DEFAULT CURRENT_TIMESTAMP;
