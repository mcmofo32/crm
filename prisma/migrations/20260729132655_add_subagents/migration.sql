-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "subagentId" TEXT;

-- CreateTable
CREATE TABLE "Subagent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "teamId" TEXT NOT NULL,

    CONSTRAINT "Subagent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Subagent_teamId_idx" ON "Subagent"("teamId");

-- AddForeignKey
ALTER TABLE "Subagent" ADD CONSTRAINT "Subagent_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_subagentId_fkey" FOREIGN KEY ("subagentId") REFERENCES "Subagent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
