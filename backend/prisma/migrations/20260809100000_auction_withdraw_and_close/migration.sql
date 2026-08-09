-- AlterEnum
ALTER TYPE "AuctionItemResolutionStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "Auction" ADD COLUMN     "closeReason" TEXT;

-- AlterTable
ALTER TABLE "AuctionItem" ADD COLUMN     "cancelReason" TEXT;

-- CreateTable
CREATE TABLE "AuctionItemWithdrawal" (
    "id" TEXT NOT NULL,
    "auctionItemId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuctionItemWithdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuctionItemWithdrawal_auctionItemId_characterId_key" ON "AuctionItemWithdrawal"("auctionItemId", "characterId");

-- AddForeignKey
ALTER TABLE "AuctionItemWithdrawal" ADD CONSTRAINT "AuctionItemWithdrawal_auctionItemId_fkey" FOREIGN KEY ("auctionItemId") REFERENCES "AuctionItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionItemWithdrawal" ADD CONSTRAINT "AuctionItemWithdrawal_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
