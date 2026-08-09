-- CreateEnum
CREATE TYPE "ActivityEmissionMode" AS ENUM ('DAILY', 'RISING_EDGE');

-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "emissionMode" "ActivityEmissionMode" NOT NULL DEFAULT 'DAILY';
