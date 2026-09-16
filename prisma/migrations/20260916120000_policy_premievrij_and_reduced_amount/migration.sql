-- AlterEnum
ALTER TYPE "PolicyStatus" ADD VALUE 'PREMIEVRIJ';

-- AlterTable
ALTER TABLE "Policy" ADD COLUMN "reducedAmount" DECIMAL(10,2);
