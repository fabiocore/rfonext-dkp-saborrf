-- AlterTable
ALTER TABLE "Activity" DROP COLUMN "scheduleRecurrenceRule",
ADD COLUMN     "scheduleTimeUtcMinutes" INTEGER,
ADD COLUMN     "scheduleWeekdaysUtc" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);
