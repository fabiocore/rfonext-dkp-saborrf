-- Novo papel VICE_GM (mesmos direitos do GM em tudo)
ALTER TYPE "UserRole" ADD VALUE 'VICE_GM';

-- Vínculo opcional Character -> User (conta de login dona do personagem)
ALTER TABLE "Character" ADD COLUMN "linkedUserId" TEXT;
ALTER TABLE "Character" ADD CONSTRAINT "Character_linkedUserId_fkey"
  FOREIGN KEY ("linkedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "Character_linkedUserId_key" ON "Character"("linkedUserId");
