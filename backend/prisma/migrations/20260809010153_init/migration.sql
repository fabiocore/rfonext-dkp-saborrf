-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('GM', 'COUNCIL');

-- CreateEnum
CREATE TYPE "CharacterStatus" AS ENUM ('PRINCIPAL', 'ALT', 'ALT_ONLY');

-- CreateEnum
CREATE TYPE "ActivitySourceType" AS ENUM ('XML_COLUMN', 'MANUAL');

-- CreateEnum
CREATE TYPE "ActivityScheduleType" AS ENUM ('NONE', 'ONE_TIME', 'RECURRING');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "LedgerTransactionType" AS ENUM ('ACTIVITY_EMISSION', 'MANUAL_EVENT_EMISSION', 'AUCTION_WIN_BURN', 'TRANSFER_OUT', 'TRANSFER_IN', 'WEEKLY_TAX_BURN', 'GM_MANUAL_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "AuctionStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "AuctionItemResolutionStatus" AS ENUM ('PENDING', 'WON', 'UNCLAIMED');

-- CreateTable
CREATE TABLE "GuildSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "guildName" TEXT NOT NULL,
    "currencyName" TEXT NOT NULL DEFAULT 'Bear Coins',
    "currencyAbbr" TEXT NOT NULL DEFAULT 'BRC',
    "defaultLocale" TEXT NOT NULL DEFAULT 'pt-BR',
    "weeklyTaxPercent" INTEGER NOT NULL DEFAULT 10,
    "weeklyTaxWeekday" INTEGER NOT NULL DEFAULT 1,
    "logoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuildSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Character" (
    "id" TEXT NOT NULL,
    "gameName" TEXT NOT NULL,
    "status" "CharacterStatus" NOT NULL DEFAULT 'PRINCIPAL',
    "linkedPrincipalId" TEXT,
    "level" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Character_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brcValue" INTEGER NOT NULL DEFAULT 0,
    "sourceType" "ActivitySourceType" NOT NULL DEFAULT 'MANUAL',
    "isNameLocked" BOOLEAN NOT NULL DEFAULT false,
    "isComposite" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "showOnEventsPanel" BOOLEAN NOT NULL DEFAULT false,
    "scheduleType" "ActivityScheduleType" NOT NULL DEFAULT 'NONE',
    "scheduleOneTimeAt" TIMESTAMP(3),
    "scheduleRecurrenceRule" TEXT,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityComponent" (
    "id" TEXT NOT NULL,
    "compositeActivityId" TEXT NOT NULL,
    "componentActivityId" TEXT NOT NULL,

    CONSTRAINT "ActivityComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "referenceDate" DATE NOT NULL,
    "uploadedById" TEXT,
    "status" "ImportStatus" NOT NULL DEFAULT 'PROCESSED',
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "newCharactersDetected" INTEGER NOT NULL DEFAULT 0,
    "newActivitiesDetected" INTEGER NOT NULL DEFAULT 0,
    "errorDetail" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityCheckIn" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "referenceDate" DATE NOT NULL,
    "checked" BOOLEAN NOT NULL,
    "importBatchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityCheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerTransaction" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" "LedgerTransactionType" NOT NULL,
    "reasonText" TEXT,
    "proofImageUrl" TEXT,
    "createdById" TEXT,
    "sourceActivityId" TEXT,
    "sourceReferenceDate" DATE,
    "manualEventBatchId" TEXT,
    "auctionItemId" TEXT,
    "transferGroupId" TEXT,
    "weeklyTaxRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManualEventBatch" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "brcValueEach" INTEGER NOT NULL,
    "proofImageUrl" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManualEventBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyTaxRun" (
    "id" TEXT NOT NULL,
    "runDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "percentApplied" INTEGER NOT NULL,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalCharactersTaxed" INTEGER NOT NULL DEFAULT 0,
    "totalAmountBurned" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WeeklyTaxRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Protection" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "minBid" INTEGER NOT NULL,
    "minLevel" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Protection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Auction" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "AuctionStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Auction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuctionApproval" (
    "id" TEXT NOT NULL,
    "auctionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuctionApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuctionItem" (
    "id" TEXT NOT NULL,
    "auctionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "protectionId" TEXT,
    "imageUrl" TEXT,
    "winningBidId" TEXT,
    "resolutionStatus" "AuctionItemResolutionStatus" NOT NULL DEFAULT 'PENDING',
    "diceRollDetail" JSONB,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuctionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuctionParticipant" (
    "id" TEXT NOT NULL,
    "auctionId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "accessCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuctionParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bid" (
    "id" TEXT NOT NULL,
    "auctionItemId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "placedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bid_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Character_gameName_key" ON "Character"("gameName");

-- CreateIndex
CREATE INDEX "Character_status_isActive_idx" ON "Character"("status", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Activity_name_key" ON "Activity"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityComponent_compositeActivityId_componentActivityId_key" ON "ActivityComponent"("compositeActivityId", "componentActivityId");

-- CreateIndex
CREATE UNIQUE INDEX "ImportBatch_fileName_key" ON "ImportBatch"("fileName");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityCheckIn_characterId_activityId_referenceDate_key" ON "ActivityCheckIn"("characterId", "activityId", "referenceDate");

-- CreateIndex
CREATE INDEX "LedgerTransaction_characterId_idx" ON "LedgerTransaction"("characterId");

-- CreateIndex
CREATE INDEX "LedgerTransaction_type_idx" ON "LedgerTransaction"("type");

-- CreateIndex
CREATE INDEX "LedgerTransaction_transferGroupId_idx" ON "LedgerTransaction"("transferGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "AuctionApproval_auctionId_userId_key" ON "AuctionApproval"("auctionId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "AuctionItem_winningBidId_key" ON "AuctionItem"("winningBidId");

-- CreateIndex
CREATE UNIQUE INDEX "AuctionParticipant_accessCode_key" ON "AuctionParticipant"("accessCode");

-- CreateIndex
CREATE UNIQUE INDEX "AuctionParticipant_auctionId_characterId_key" ON "AuctionParticipant"("auctionId", "characterId");

-- CreateIndex
CREATE INDEX "Bid_auctionItemId_idx" ON "Bid"("auctionItemId");

-- CreateIndex
CREATE INDEX "Bid_characterId_idx" ON "Bid"("characterId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_linkedPrincipalId_fkey" FOREIGN KEY ("linkedPrincipalId") REFERENCES "Character"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityComponent" ADD CONSTRAINT "ActivityComponent_compositeActivityId_fkey" FOREIGN KEY ("compositeActivityId") REFERENCES "Activity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityComponent" ADD CONSTRAINT "ActivityComponent_componentActivityId_fkey" FOREIGN KEY ("componentActivityId") REFERENCES "Activity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityCheckIn" ADD CONSTRAINT "ActivityCheckIn_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityCheckIn" ADD CONSTRAINT "ActivityCheckIn_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityCheckIn" ADD CONSTRAINT "ActivityCheckIn_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerTransaction" ADD CONSTRAINT "LedgerTransaction_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerTransaction" ADD CONSTRAINT "LedgerTransaction_sourceActivityId_fkey" FOREIGN KEY ("sourceActivityId") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerTransaction" ADD CONSTRAINT "LedgerTransaction_manualEventBatchId_fkey" FOREIGN KEY ("manualEventBatchId") REFERENCES "ManualEventBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerTransaction" ADD CONSTRAINT "LedgerTransaction_auctionItemId_fkey" FOREIGN KEY ("auctionItemId") REFERENCES "AuctionItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerTransaction" ADD CONSTRAINT "LedgerTransaction_weeklyTaxRunId_fkey" FOREIGN KEY ("weeklyTaxRunId") REFERENCES "WeeklyTaxRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionApproval" ADD CONSTRAINT "AuctionApproval_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "Auction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionItem" ADD CONSTRAINT "AuctionItem_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "Auction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionItem" ADD CONSTRAINT "AuctionItem_protectionId_fkey" FOREIGN KEY ("protectionId") REFERENCES "Protection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionItem" ADD CONSTRAINT "AuctionItem_winningBidId_fkey" FOREIGN KEY ("winningBidId") REFERENCES "Bid"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionParticipant" ADD CONSTRAINT "AuctionParticipant_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "Auction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionParticipant" ADD CONSTRAINT "AuctionParticipant_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_auctionItemId_fkey" FOREIGN KEY ("auctionItemId") REFERENCES "AuctionItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
