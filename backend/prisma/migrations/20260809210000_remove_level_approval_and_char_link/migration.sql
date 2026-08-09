-- Remove vinculo Character -> User (so existia pra bypassar a fila de
-- aprovacao de nivel, que deixou de existir)
ALTER TABLE "Character" DROP CONSTRAINT IF EXISTS "Character_linkedUserId_fkey";
DROP INDEX IF EXISTS "Character_linkedUserId_key";
ALTER TABLE "Character" DROP COLUMN IF EXISTS "linkedUserId";

-- Simplifica LevelChangeRequest: vira log historico simples (sem fila de
-- aprovacao). "requestedLevel" -> "level" (nao e mais um "pedido"), print
-- de comprovacao passa a ser opcional, remove status/revisor/motivo.
ALTER TABLE "LevelChangeRequest" RENAME COLUMN "requestedLevel" TO "level";
ALTER TABLE "LevelChangeRequest" ALTER COLUMN "proofImageUrl" DROP NOT NULL;
ALTER TABLE "LevelChangeRequest" DROP COLUMN IF EXISTS "status";
ALTER TABLE "LevelChangeRequest" DROP COLUMN IF EXISTS "reviewedById";
ALTER TABLE "LevelChangeRequest" DROP COLUMN IF EXISTS "reviewedAt";
ALTER TABLE "LevelChangeRequest" DROP COLUMN IF EXISTS "rejectReason";
DROP INDEX IF EXISTS "LevelChangeRequest_status_idx";
DROP TYPE IF EXISTS "LevelChangeRequestStatus";
