-- AlterTable
ALTER TABLE "ManualEventBatch" ADD COLUMN     "activityId" TEXT;

-- AddForeignKey
ALTER TABLE "ManualEventBatch" ADD CONSTRAINT "ManualEventBatch_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
