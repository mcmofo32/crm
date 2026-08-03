-- CreateEnum
CREATE TYPE "TaxDeclarationStatus" AS ENUM ('DONE', 'TODO', 'SCHEDULED');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "verifiedById" TEXT;

-- AlterTable
ALTER TABLE "EventAttendance" ADD COLUMN     "actualStatus" "AttendanceStatus";

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "caseManagerSubagentId" TEXT,
ADD COLUMN     "caseManagerUserId" TEXT,
ADD COLUMN     "taxDeclarationStatus" "TaxDeclarationStatus";

-- CreateTable
CREATE TABLE "CustomerYearPeriod" (
    "id" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerYearPeriod_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_caseManagerUserId_fkey" FOREIGN KEY ("caseManagerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_caseManagerSubagentId_fkey" FOREIGN KEY ("caseManagerSubagentId") REFERENCES "Subagent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
