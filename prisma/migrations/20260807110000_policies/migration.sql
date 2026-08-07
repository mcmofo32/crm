-- CreateEnum
CREATE TYPE "InsuranceCompany" AS ENUM ('VIVIUM', 'AXA', 'DELA', 'CREDIMO');

-- CreateEnum
CREATE TYPE "PolicyStatus" AS ENUM ('OPGELADEN_WACHT_ACTIEF', 'ACTIEF', 'UITBETAALD', 'GEANNULEERD', 'BACKOFFICE', 'POLIS_NOG_TEKENEN', 'PROBLEEM_DOCUMENTEN', 'POLIS_NOG_OPMAKEN', 'AFWACHTEND_EERSTE_PREMIE');

-- CreateTable
CREATE TABLE "Policy" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "leadProductId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "company" "InsuranceCompany",
    "status" "PolicyStatus" NOT NULL DEFAULT 'OPGELADEN_WACHT_ACTIEF',
    "easy" BOOLEAN NOT NULL DEFAULT false,
    "tool" BOOLEAN NOT NULL DEFAULT false,
    "rl" BOOLEAN NOT NULL DEFAULT false,
    "saFile" BOOLEAN NOT NULL DEFAULT false,
    "ccFile" BOOLEAN NOT NULL DEFAULT false,
    "ingangsdatum" TIMESTAMP(3),
    "betaaldOp" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Policy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Policy_leadProductId_key" ON "Policy"("leadProductId");

-- CreateIndex
CREATE INDEX "Policy_leadId_idx" ON "Policy"("leadId");

-- CreateIndex
CREATE INDEX "Policy_employeeId_idx" ON "Policy"("employeeId");

-- CreateIndex
CREATE INDEX "Policy_status_idx" ON "Policy"("status");

-- CreateIndex
CREATE UNIQUE INDEX "LeadProduct_leadId_type_key" ON "LeadProduct"("leadId", "type");

-- AddForeignKey
ALTER TABLE "Policy" ADD CONSTRAINT "Policy_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Policy" ADD CONSTRAINT "Policy_leadProductId_fkey" FOREIGN KEY ("leadProductId") REFERENCES "LeadProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Policy" ADD CONSTRAINT "Policy_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
