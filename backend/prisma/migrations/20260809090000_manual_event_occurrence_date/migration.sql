-- AlterTable
ALTER TABLE "ManualEventBatch" ADD COLUMN     "occurrenceDate" DATE;

-- CreateIndex
CREATE UNIQUE INDEX "ManualEventBatch_activityId_occurrenceDate_key" ON "ManualEventBatch"("activityId", "occurrenceDate");
