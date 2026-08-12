-- CreateTable
CREATE TABLE "DismissedDuplicateGroup" (
    "id" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "dismissedById" TEXT NOT NULL,
    "dismissedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DismissedDuplicateGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DismissedDuplicateGroup_signature_key" ON "DismissedDuplicateGroup"("signature");

-- AddForeignKey
ALTER TABLE "DismissedDuplicateGroup" ADD CONSTRAINT "DismissedDuplicateGroup_dismissedById_fkey" FOREIGN KEY ("dismissedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
