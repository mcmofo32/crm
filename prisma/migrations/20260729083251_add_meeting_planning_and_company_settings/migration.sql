-- CreateEnum
CREATE TYPE "MeetingMode" AS ENUM ('ONSITE', 'ONLINE');

-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "location" TEXT,
ADD COLUMN     "meetingLink" TEXT,
ADD COLUMN     "meetingMode" "MeetingMode";

-- CreateTable
CREATE TABLE "CompanySettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "zoomLink" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanySettings_pkey" PRIMARY KEY ("id")
);
