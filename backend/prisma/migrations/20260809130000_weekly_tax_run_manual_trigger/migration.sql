-- AlterTable
ALTER TABLE "WeeklyTaxRun" ADD COLUMN     "triggeredManually" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reason" TEXT,
ADD COLUMN     "triggeredById" TEXT;
