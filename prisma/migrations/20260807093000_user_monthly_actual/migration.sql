-- CreateTable
CREATE TABLE "UserMonthlyActual" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "metric" "GoalMetric" NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserMonthlyActual_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserMonthlyActual_userId_metric_year_idx" ON "UserMonthlyActual"("userId", "metric", "year");

-- CreateIndex
CREATE UNIQUE INDEX "UserMonthlyActual_userId_metric_year_month_key" ON "UserMonthlyActual"("userId", "metric", "year", "month");

-- AddForeignKey
ALTER TABLE "UserMonthlyActual" ADD CONSTRAINT "UserMonthlyActual_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
