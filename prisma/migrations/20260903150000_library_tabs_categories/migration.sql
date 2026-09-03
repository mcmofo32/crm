-- CreateTable
CREATE TABLE "LibraryTab" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LibraryTab_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibraryCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tabId" TEXT NOT NULL,

    CONSTRAINT "LibraryCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LibraryTab_name_key" ON "LibraryTab"("name");

-- CreateIndex
CREATE INDEX "LibraryCategory_tabId_idx" ON "LibraryCategory"("tabId");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryCategory_tabId_name_key" ON "LibraryCategory"("tabId", "name");

-- AddForeignKey
ALTER TABLE "LibraryCategory" ADD CONSTRAINT "LibraryCategory_tabId_fkey" FOREIGN KEY ("tabId") REFERENCES "LibraryTab"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: categoryId eerst nullable toevoegen, zodat dit ook veilig is
-- als er (ondanks de gekende upload-bug) toch al documenten zouden bestaan.
ALTER TABLE "LibraryDocument" ADD COLUMN "categoryId" TEXT;

-- Backfill: bestaande documenten (indien die er zijn) krijgen een
-- standaardtabblad/-categorie, zodat de kolom hierna NOT NULL gemaakt kan
-- worden zonder rijen te verliezen.
DO $$
DECLARE
  default_tab_id TEXT;
  default_category_id TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM "LibraryDocument" WHERE "categoryId" IS NULL) THEN
    default_tab_id := gen_random_uuid()::text;
    default_category_id := gen_random_uuid()::text;
    INSERT INTO "LibraryTab" ("id", "name", "order") VALUES (default_tab_id, 'Documenten', 0);
    INSERT INTO "LibraryCategory" ("id", "name", "order", "tabId") VALUES (default_category_id, 'Algemeen', 0, default_tab_id);
    UPDATE "LibraryDocument" SET "categoryId" = default_category_id WHERE "categoryId" IS NULL;
  END IF;
END $$;

-- AlterTable: nu pas verplicht maken
ALTER TABLE "LibraryDocument" ALTER COLUMN "categoryId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "LibraryDocument_categoryId_idx" ON "LibraryDocument"("categoryId");

-- AddForeignKey
ALTER TABLE "LibraryDocument" ADD CONSTRAINT "LibraryDocument_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "LibraryCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
