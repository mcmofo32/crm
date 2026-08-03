/*
  Warnings:

  - You are about to drop the `UserMonthlyGoal` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "UserMonthlyGoal" DROP CONSTRAINT "UserMonthlyGoal_userId_fkey";

-- DropTable
DROP TABLE "UserMonthlyGoal";
