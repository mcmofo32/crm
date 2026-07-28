-- CreateEnum
CREATE TYPE "IncentiveGoalType" AS ENUM ('LEADS_WON', 'ACTIVITIES_COMPLETED');

-- CreateTable
CREATE TABLE "Incentive" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "goalType" "IncentiveGoalType" NOT NULL DEFAULT 'LEADS_WON',
    "leadType" "LeadType",
    "targetValue" INTEGER,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "posterData" BYTEA,
    "posterMimeType" TEXT,
    "posterFilename" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Incentive_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Incentive_startDate_endDate_idx" ON "Incentive"("startDate", "endDate");

-- AddForeignKey
ALTER TABLE "Incentive" ADD CONSTRAINT "Incentive_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
