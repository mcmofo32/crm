-- Data-correctie (geen schemawijziging): rechtstreeks/bulk aangemaakte
-- klanten (via "Klant toevoegen" of de bulk-Excel-import, createWonLeadRecord
-- in leads.ts) kregen tot nu toe standaard de uitvoerder van de actie als
-- dossierbeheerder (caseManagerUserId), i.p.v. de eigenlijke eigenaar. Wie
-- ooit een bulk-import deed namens collega's, werd daardoor zelf
-- "dossierbeheerder" van al die klanten. Deze migratie herstelt de al
-- bestaande, foutief toegewezen rijen éénmalig.
--
-- Herkenning: enkel leads die via createWonLeadRecord aangemaakt zijn
-- (herkenbaar aan een stage-overgang met fromStageId IS NULL — exact wat die
-- functie aanmaakt, in tegenstelling tot de normale funnel-flow die altijd
-- een fromStageId heeft) EN waarvan caseManagerUserId nog exact gelijk is
-- aan createdById (dus nog nooit manueel aangepast sinds aanmaak — zie
-- setCaseManagerAction, dat dit veld expliciet wijzigt). Idempotent: op een
-- lead die al correct staat (caseManagerUserId = ownerId) verandert dit
-- niets.
UPDATE "Lead" AS l
SET "caseManagerUserId" = l."ownerId"
WHERE l."status" = 'WON'
  AND l."caseManagerUserId" = l."createdById"
  AND l."caseManagerUserId" <> l."ownerId"
  AND EXISTS (
    SELECT 1
    FROM "LeadStageChange" AS lsc
    WHERE lsc."leadId" = l."id"
      AND lsc."fromStageId" IS NULL
  );
