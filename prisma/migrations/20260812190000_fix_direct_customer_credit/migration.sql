-- Data-correctie (geen schemawijziging): rechtstreeks/bulk aangemaakte
-- klanten (via "Klant toevoegen" of de bulk-Excel-import, createWonLeadRecord
-- in leads.ts) kregen tot nu toe het "behaalde klant"-krediet
-- (LeadStageChange.changedById) op naam van wie de actie uitvoerde, i.p.v.
-- de eigenlijke eigenaar/verkoper (Lead.ownerId). Dat vertekende de
-- productiemaand-doelen/cijfers van wie een import namens anderen deed. Deze
-- migratie herstelt de al bestaande, foutief toegewezen rijen éénmalig.
--
-- Herkenning: enkel de allereerste stage-overgang van een lead
-- (fromStageId IS NULL) naar een "gewonnen"-fase kan van deze bug afkomstig
-- zijn — dat is exact (en enkel) de overgang die createWonLeadRecord
-- aanmaakt. Een lead die via de normale funnel gewonnen werd (drag-and-drop/
-- StageSelect), heeft altijd een fromStageId. Idempotent: op een lead die al
-- correct staat (changedById = ownerId) verandert dit niets.
UPDATE "LeadStageChange" AS lsc
SET "changedById" = l."ownerId"
FROM "Lead" AS l, "FunnelStage" AS fs
WHERE lsc."leadId" = l."id"
  AND fs."id" = lsc."toStageId"
  AND lsc."fromStageId" IS NULL
  AND fs."isWon" = true
  AND lsc."changedById" <> l."ownerId";
