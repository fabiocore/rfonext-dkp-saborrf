-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'UNKNOWN');

-- DropIndex
DROP INDEX "Character_status_isActive_idx";

-- AlterTable
ALTER TABLE "Character" DROP COLUMN "isActive",
ADD COLUMN     "membershipStatus" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateIndex
CREATE INDEX "Character_status_membershipStatus_idx" ON "Character"("status", "membershipStatus");
