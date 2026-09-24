-- CreateTable
CREATE TABLE "CompanyProductionBaseline" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "leadType" "LeadType" NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyProductionBaseline_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyProductionBaseline_year_leadType_key" ON "CompanyProductionBaseline"("year", "leadType");
