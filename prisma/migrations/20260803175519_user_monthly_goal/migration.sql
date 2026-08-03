-- CreateTable
CREATE TABLE "UserMonthlyGoal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "metric" "GoalMetric" NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "target" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserMonthlyGoal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserMonthlyGoal_userId_metric_year_idx" ON "UserMonthlyGoal"("userId", "metric", "year");

-- CreateIndex
CREATE UNIQUE INDEX "UserMonthlyGoal_userId_metric_year_month_key" ON "UserMonthlyGoal"("userId", "metric", "year", "month");

-- AddForeignKey
ALTER TABLE "UserMonthlyGoal" ADD CONSTRAINT "UserMonthlyGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
