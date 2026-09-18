-- CreateEnum
CREATE TYPE "LibrarySection" AS ENUM ('ALGEMEEN', 'MANAGEMENT', 'SUBAGENT');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isManagement" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: bestaande tabbladen horen allemaal bij de algemene sectie.
ALTER TABLE "LibraryTab" ADD COLUMN     "section" "LibrarySection" NOT NULL DEFAULT 'ALGEMEEN';

-- DropIndex: "name" alleen was uniek; nu moet dat enkel binnen dezelfde sectie zo zijn.
DROP INDEX "LibraryTab_name_key";

-- CreateIndex
CREATE UNIQUE INDEX "LibraryTab_section_name_key" ON "LibraryTab"("section", "name");
