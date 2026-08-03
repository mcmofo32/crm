-- CreateEnum
CREATE TYPE "AgentType" AS ENUM ('ANALYST', 'SUBAGENT');

-- AlterTable: voeg de nieuwe kolom toe vóór de oude weg is, zodat we de
-- bestaande isSubagent-waarden kunnen overzetten i.p.v. verliezen.
ALTER TABLE "User" ADD COLUMN "agentType" "AgentType" NOT NULL DEFAULT 'ANALYST';

-- DataMigration: zet bestaande subagenten over naar de nieuwe kolom.
UPDATE "User" SET "agentType" = 'SUBAGENT' WHERE "isSubagent" = true;

-- AlterTable: oude boolean-kolom is niet meer nodig.
ALTER TABLE "User" DROP COLUMN "isSubagent";
