-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('PENSIOENSPAREN', 'LANGETERMIJNSPAREN', 'BELEGGEN', 'DELA', 'VAPZ', 'IPT', 'KINDERSPAREN');

-- AlterTable
ALTER TABLE "Lead" DROP COLUMN "units";

-- CreateTable
CREATE TABLE "LeadProduct" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "type" "ProductType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "units" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeadProduct_leadId_idx" ON "LeadProduct"("leadId");

-- AddForeignKey
ALTER TABLE "LeadProduct" ADD CONSTRAINT "LeadProduct_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
