-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "wasVoicemail" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "characteristics" TEXT,
ADD COLUMN     "isInformed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "qualityScore" INTEGER;
