-- CreateEnum
CREATE TYPE "IncentiveMetric" AS ENUM ('CLIENTS_WON', 'UNITS', 'RG_MEETINGS', 'ACTIVITIES_COMPLETED');

-- CreateEnum
CREATE TYPE "IncentiveMode" AS ENUM ('THRESHOLD', 'TOP_N');

-- AlterTable: nieuwe kolommen toevoegen (oude kolommen blijven nog even staan)
ALTER TABLE "Incentive"
  ADD COLUMN "mode" "IncentiveMode" NOT NULL DEFAULT 'THRESHOLD',
  ADD COLUMN "rankingLeadType" "LeadType",
  ADD COLUMN "rankingMetric" "IncentiveMetric",
  ADD COLUMN "topN" INTEGER;

-- Bestaande incentives hadden geen richtcijfer-per-categorie systeem: migreer
-- ze naar de nieuwe top-1 modus zodat hun instelling (metric + funnel-filter)
-- bewaard blijft.
UPDATE "Incentive"
SET
  "mode" = 'TOP_N',
  "rankingMetric" = CASE "goalType"
    WHEN 'LEADS_WON' THEN 'CLIENTS_WON'::"IncentiveMetric"
    WHEN 'ACTIVITIES_COMPLETED' THEN 'ACTIVITIES_COMPLETED'::"IncentiveMetric"
  END,
  "rankingLeadType" = "leadType",
  "topN" = 1;

-- AlterTable: oude kolommen nu verwijderen
ALTER TABLE "Incentive"
  DROP COLUMN "goalType",
  DROP COLUMN "leadType",
  DROP COLUMN "targetValue";

-- DropEnum
DROP TYPE "IncentiveGoalType";

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "units" INTEGER;

-- CreateTable
CREATE TABLE "IncentiveCategory" (
    "id" TEXT NOT NULL,
    "incentiveId" TEXT NOT NULL,
    "metric" "IncentiveMetric" NOT NULL,
    "leadType" "LeadType",
    "targetValue" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "IncentiveCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IncentiveCategory_incentiveId_idx" ON "IncentiveCategory"("incentiveId");

-- AddForeignKey
ALTER TABLE "IncentiveCategory" ADD CONSTRAINT "IncentiveCategory_incentiveId_fkey" FOREIGN KEY ("incentiveId") REFERENCES "Incentive"("id") ON DELETE CASCADE ON UPDATE CASCADE;
