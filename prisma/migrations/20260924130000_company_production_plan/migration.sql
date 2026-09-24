-- CreateTable
CREATE TABLE "CompanyProductionGoal" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "quarter" INTEGER NOT NULL,
    "monthlyTarget" DECIMAL(12,2) NOT NULL,
    "actualUnits" DECIMAL(12,2),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyProductionGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyProductionContribution" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "units" DECIMAL(12,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyProductionContribution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyProductionGoal_year_quarter_key" ON "CompanyProductionGoal"("year", "quarter");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyProductionContribution_year_userId_key" ON "CompanyProductionContribution"("year", "userId");

-- AddForeignKey
ALTER TABLE "CompanyProductionContribution" ADD CONSTRAINT "CompanyProductionContribution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
