-- Vervangen door UserMonthlyActual: die bevat al de per-gebruiker,
-- per-productiemaand correcties (Robin's team gebruikt dit al op de
-- Productie-pagina) en is dus de correcte bron voor het Bedrijfsjaarplan
-- i.p.v. dit aparte, pas deze week toegevoegde correctiemechanisme.

-- DropForeignKey
ALTER TABLE "CompanyProductionContribution" DROP CONSTRAINT "CompanyProductionContribution_userId_fkey";

-- DropTable
DROP TABLE "CompanyProductionContribution";
