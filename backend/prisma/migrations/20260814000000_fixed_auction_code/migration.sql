-- Código de leilão fixo por personagem (ver comentário em schema.prisma) —
-- substitui o código por participação, que era gerado de novo a cada
-- leilão publicado.
ALTER TABLE "Character" ADD COLUMN "auctionAccessCode" TEXT;
CREATE UNIQUE INDEX "Character_auctionAccessCode_key" ON "Character"("auctionAccessCode");

DROP INDEX IF EXISTS "AuctionParticipant_accessCode_key";
ALTER TABLE "AuctionParticipant" DROP COLUMN "accessCode";
