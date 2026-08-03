-- CreateEnum
CREATE TYPE "JobFunction" AS ENUM ('FT1', 'FT2', 'FT3', 'FTC', 'FA', 'FC', 'DC', 'RC', 'NC');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "jobFunction" "JobFunction";
