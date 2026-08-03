-- CreateTable
CREATE TABLE "GoalPeriod" (
    "id" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoalPeriod_pkey" PRIMARY KEY ("id")
);
