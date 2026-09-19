-- CreateEnum
CREATE TYPE "BoarStatus" AS ENUM ('NOG_CONTACTEREN', 'LEAD_DOORGEGEVEN', 'BOAR_IN_ORDE', 'GEEN_INTERESSE');

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "boarStatus" "BoarStatus",
ADD COLUMN     "boarNotes" TEXT,
ADD COLUMN     "boarProductNotes" TEXT;
