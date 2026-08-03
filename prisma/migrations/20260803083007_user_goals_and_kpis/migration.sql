-- CreateEnum
CREATE TYPE "GoalMetric" AS ENUM ('UNITS', 'CUSTOMERS', 'CONVERSATIONS', 'ABV_SALES', 'ABV_RG');

-- CreateEnum
CREATE TYPE "KpiMetric" AS ENUM ('CONVERSATIONS', 'PRODUCTION', 'CALLING_SESSION', 'SEMINAR');

-- CreateTable
CREATE TABLE "UserGoal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "metric" "GoalMetric" NOT NULL,
    "target" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserKpiGoal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "metric" "KpiMetric" NOT NULL,
    "year" INTEGER NOT NULL,
    "target" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserKpiGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserKpiMonthlyEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "metric" "KpiMetric" NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserKpiMonthlyEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserGoal_userId_metric_key" ON "UserGoal"("userId", "metric");

-- CreateIndex
CREATE UNIQUE INDEX "UserKpiGoal_userId_metric_year_key" ON "UserKpiGoal"("userId", "metric", "year");

-- CreateIndex
CREATE INDEX "UserKpiMonthlyEntry_userId_metric_year_idx" ON "UserKpiMonthlyEntry"("userId", "metric", "year");

-- CreateIndex
CREATE UNIQUE INDEX "UserKpiMonthlyEntry_userId_metric_year_month_key" ON "UserKpiMonthlyEntry"("userId", "metric", "year", "month");

-- AddForeignKey
ALTER TABLE "UserGoal" ADD CONSTRAINT "UserGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserKpiGoal" ADD CONSTRAINT "UserKpiGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserKpiMonthlyEntry" ADD CONSTRAINT "UserKpiMonthlyEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
