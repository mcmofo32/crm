-- DropIndex
DROP INDEX "CompanyProductionGoal_year_quarter_key";

-- DropIndex
DROP INDEX "CompanyProductionContribution_year_userId_key";

-- AlterTable
ALTER TABLE "CompanyProductionGoal" ADD COLUMN "leadType" "LeadType" NOT NULL DEFAULT 'FA';

-- AlterTable
ALTER TABLE "CompanyProductionContribution" ADD COLUMN "leadType" "LeadType" NOT NULL DEFAULT 'FA';

-- CreateIndex
CREATE UNIQUE INDEX "CompanyProductionGoal_year_quarter_leadType_key" ON "CompanyProductionGoal"("year", "quarter", "leadType");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyProductionContribution_year_userId_leadType_key" ON "CompanyProductionContribution"("year", "userId", "leadType");

-- AlterTable: drop the temporary default now that existing rows are backfilled — every write from the app sets leadType explicitly.
ALTER TABLE "CompanyProductionGoal" ALTER COLUMN "leadType" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CompanyProductionContribution" ALTER COLUMN "leadType" DROP DEFAULT;
