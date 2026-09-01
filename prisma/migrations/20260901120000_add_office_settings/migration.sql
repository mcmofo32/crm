-- CreateTable
CREATE TABLE "OfficeSettings" (
    "id" TEXT NOT NULL,
    "address" TEXT,
    "note" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfficeSettings_pkey" PRIMARY KEY ("id")
);
