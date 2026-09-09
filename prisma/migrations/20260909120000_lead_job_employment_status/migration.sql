-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('BEDIENDE', 'ZELFSTANDIGE', 'ARBEIDER', 'AMBTENAAR');

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "job" TEXT,
ADD COLUMN     "employmentStatus" "EmploymentStatus";
