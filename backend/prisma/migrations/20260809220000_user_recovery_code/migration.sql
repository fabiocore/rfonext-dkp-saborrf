-- Código de recuperação de senha (opcional, definido pela própria pessoa
-- enquanto logada) — ver comentário no model User em schema.prisma.
ALTER TABLE "User" ADD COLUMN "recoveryCodeHash" TEXT;
ALTER TABLE "User" ADD COLUMN "recoveryCodeUpdatedAt" TIMESTAMP(3);
