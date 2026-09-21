-- CreateEnum
CREATE TYPE "LeadDocumentKind" AS ENUM ('FA_FICHE', 'BUDGETTERING', 'PORTEFEUILLE');

-- CreateTable
CREATE TABLE "LeadDocument" (
    "id" TEXT NOT NULL,
    "kind" "LeadDocumentKind" NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "downloadUrl" TEXT NOT NULL,
    "blobPathname" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "leadId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,

    CONSTRAINT "LeadDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeadDocument_leadId_idx" ON "LeadDocument"("leadId");

-- CreateIndex
CREATE INDEX "LeadDocument_uploadedById_idx" ON "LeadDocument"("uploadedById");

-- CreateIndex
CREATE UNIQUE INDEX "LeadDocument_leadId_kind_key" ON "LeadDocument"("leadId", "kind");

-- AddForeignKey
ALTER TABLE "LeadDocument" ADD CONSTRAINT "LeadDocument_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadDocument" ADD CONSTRAINT "LeadDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
