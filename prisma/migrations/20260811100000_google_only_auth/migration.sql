-- AlterTable
ALTER TABLE "User" DROP COLUMN "mustChangePassword",
DROP COLUMN "passwordHash",
DROP COLUMN "failedLoginAttempts",
DROP COLUMN "lockedUntil";
