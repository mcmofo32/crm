-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "googleCalendarId" TEXT,
ADD COLUMN     "googleEventId" TEXT,
ADD COLUMN     "googleSyncError" TEXT;

-- CreateTable
CREATE TABLE "EventSubagentInvite" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "subagentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventSubagentInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventSubagentInvite_subagentId_idx" ON "EventSubagentInvite"("subagentId");

-- CreateIndex
CREATE UNIQUE INDEX "EventSubagentInvite_eventId_subagentId_key" ON "EventSubagentInvite"("eventId", "subagentId");

-- AddForeignKey
ALTER TABLE "EventSubagentInvite" ADD CONSTRAINT "EventSubagentInvite_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventSubagentInvite" ADD CONSTRAINT "EventSubagentInvite_subagentId_fkey" FOREIGN KEY ("subagentId") REFERENCES "Subagent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
