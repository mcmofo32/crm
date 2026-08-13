-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "followUpStatus" "TaxDeclarationStatus";

-- Backfill: "Opvolging" en "Belastingsaangifte" deelden voorheen per ongeluk
-- dezelfde kolom. Kopieer de huidige waarde zodat geen enkele klant zijn
-- reeds ingestelde opvolgingsstatus lijkt te verliezen; vanaf nu evolueren
-- beide kolommen volledig onafhankelijk van elkaar.
UPDATE "Lead" SET "followUpStatus" = "taxDeclarationStatus" WHERE "taxDeclarationStatus" IS NOT NULL;
