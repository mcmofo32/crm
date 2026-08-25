-- CreateEnum
CREATE TYPE "FsmaModule" AS ENUM ('M1_1', 'M1_2', 'M2_1', 'M2_2', 'M2_3', 'M2_4', 'M3_1', 'M3_2', 'M4');

-- CreateEnum
CREATE TYPE "FsmaModuleStatus" AS ENUM ('OPLEIDING_TE_PLANNEN', 'OPLEIDING_INGEPLAND', 'OPLEIDING_AFGEROND', 'EXAMEN_TE_PLANNEN', 'EXAMEN_INGEPLAND', 'AFGEROND');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "referralNumber" TEXT,
ADD COLUMN     "ovbNumber" TEXT,
ADD COLUMN     "companyName" TEXT,
ADD COLUMN     "companyRegistrationNumber" TEXT,
ADD COLUMN     "registeredOffice" TEXT;

-- CreateTable
CREATE TABLE "UserFsmaModule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "module" "FsmaModule" NOT NULL,
    "status" "FsmaModuleStatus" NOT NULL DEFAULT 'OPLEIDING_TE_PLANNEN',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserFsmaModule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserFsmaModule_userId_module_key" ON "UserFsmaModule"("userId", "module");

-- AddForeignKey
ALTER TABLE "UserFsmaModule" ADD CONSTRAINT "UserFsmaModule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
