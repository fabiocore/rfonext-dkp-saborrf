-- CreateEnum
CREATE TYPE "LevelChangeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Character" ADD COLUMN     "discordId" TEXT,
ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "profileAccessCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Character_profileAccessCode_key" ON "Character"("profileAccessCode");

-- CreateTable
CREATE TABLE "LevelChangeRequest" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "requestedLevel" INTEGER NOT NULL,
    "proofImageUrl" TEXT NOT NULL,
    "status" "LevelChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LevelChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LevelChangeRequest_characterId_idx" ON "LevelChangeRequest"("characterId");

-- CreateIndex
CREATE INDEX "LevelChangeRequest_status_idx" ON "LevelChangeRequest"("status");

-- AddForeignKey
ALTER TABLE "LevelChangeRequest" ADD CONSTRAINT "LevelChangeRequest_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
