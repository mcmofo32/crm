-- DropIndex
DROP INDEX "LeadProduct_leadId_type_key";

-- AlterTable
ALTER TABLE "LeadProduct" ADD COLUMN     "contractDate" TIMESTAMP(3),
ADD COLUMN     "isFollowUp" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: elk bestaand product krijgt de datum waarop zijn klant effectief
-- klant werd (laatste overgang naar een gewonnen fase) als contractDate, of
-- anders zijn eigen aanmaakdatum als er (uitzonderlijk) geen zo'n overgang
-- gevonden wordt — zodat bestaande productiecijfers per maand niet
-- verschuiven naar "vandaag" door deze migratie.
UPDATE "LeadProduct" lp
SET "contractDate" = COALESCE(
  (
    SELECT MAX(lsc."changedAt")
    FROM "LeadStageChange" lsc
    JOIN "FunnelStage" fs ON fs.id = lsc."toStageId"
    WHERE lsc."leadId" = lp."leadId" AND fs."isWon" = true
  ),
  lp."createdAt"
);

ALTER TABLE "LeadProduct" ALTER COLUMN "contractDate" SET NOT NULL,
ALTER COLUMN "contractDate" SET DEFAULT CURRENT_TIMESTAMP;
