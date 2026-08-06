-- CreateTable
CREATE TABLE "GoogleSheetsBackup" (
    "id" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "connectedByUserId" TEXT NOT NULL,
    "connectedEmail" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "spreadsheetId" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleSheetsBackup_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "GoogleSheetsBackup" ADD CONSTRAINT "GoogleSheetsBackup_connectedByUserId_fkey" FOREIGN KEY ("connectedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
