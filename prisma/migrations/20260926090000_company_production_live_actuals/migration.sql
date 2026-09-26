-- "Gerealiseerd" wordt voortaan live berekend uit echte productiedata i.p.v.
-- manueel ingevoerd — de kolom en de tot dusver manueel ingevoerde
-- verdeling-per-medewerker zijn daarmee vervallen/achterhaald.

-- AlterTable
ALTER TABLE "CompanyProductionGoal" DROP COLUMN "actualUnits";

-- Bestaande (manueel ingevoerde, ondertussen als onjuist erkende) rijen
-- wissen vóór de kolom toe te voegen — anders is er geen zinnige maand om
-- ze aan toe te wijzen.
DELETE FROM "CompanyProductionContribution";

-- AlterTable
ALTER TABLE "CompanyProductionContribution" ADD COLUMN "month" INTEGER NOT NULL;

-- AlterIndex
DROP INDEX "CompanyProductionContribution_year_userId_leadType_key";
CREATE UNIQUE INDEX "CompanyProductionContribution_year_month_userId_leadType_key" ON "CompanyProductionContribution"("year", "month", "userId", "leadType");
