-- AlterTable
ALTER TABLE "Subagent" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Subagent_userId_key" ON "Subagent"("userId");

-- AddForeignKey
ALTER TABLE "Subagent" ADD CONSTRAINT "Subagent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

