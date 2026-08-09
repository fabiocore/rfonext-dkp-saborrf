-- AlterTable
ALTER TABLE "GuildSettings" ADD COLUMN     "pinnedAnnouncementText" TEXT;

-- Seed inicial pedido pelo GM da SaborRF (editável a qualquer momento em Configurações, só pelo GM).
UPDATE "GuildSettings" SET "pinnedAnnouncementText" = 'Faça seu Check-in, doação e atividade até às 21h GMT-3 todos os dias ou você ficará sem receber BRC.' WHERE id = 1;
