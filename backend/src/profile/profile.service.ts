import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { isValidDiscordHandle } from '../common/discord-handle.util';
import { CharactersService } from '../characters/characters.service';

/**
 * Perfil self-service do membro, acessado por código de 12 caracteres (sem
 * login) — PREMISSAS.md seção 3. Discord ID, avatar e nível aplicam todos na
 * hora, sem aprovação — a fila de aprovação de nível foi removida em
 * 2026-08-09 (não estava funcionando bem na prática e adicionava fricção
 * sem necessidade real; GM/conselho já pode corrigir qualquer nível
 * diretamente na tela de Personagens se precisar).
 */
@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly charactersService: CharactersService,
  ) {}

  private async resolveByCode(code: string) {
    const character = await this.prisma.character.findUnique({ where: { profileAccessCode: code } });
    if (!character) throw new NotFoundException('Código inválido.');
    return character;
  }

  async getProfile(code: string) {
    const character = await this.resolveByCode(code);
    const [levelChangeLog, balanceAgg, auctionAccessCode] = await Promise.all([
      this.prisma.levelChangeRequest.findMany({
        where: { characterId: character.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.ledgerTransaction.aggregate({
        where: { characterId: character.id },
        _sum: { amount: true },
      }),
      // Garante que o código de leilão fixo existe mesmo se o admin nunca
      // abriu a tela de Personagens desde que esse personagem virou
      // Principal (é o que dispara o backfill em lote de lá).
      this.charactersService.ensureAuctionCodeFor(character.id),
    ]);
    return {
      character: {
        id: character.id,
        gameName: character.gameName,
        level: character.level,
        discordId: character.discordId,
        avatarUrl: character.avatarUrl,
        balance: balanceAgg._sum.amount ?? 0,
        auctionAccessCode,
      },
      levelChangeLog,
    };
  }

  async updateDiscordId(code: string, discordId: string) {
    const character = await this.resolveByCode(code);
    const trimmed = discordId?.trim();
    if (!trimmed || !isValidDiscordHandle(trimmed)) {
      throw new BadRequestException('Discord inválido — use seu usuário (ex: fulano ou fulano#1234) ou o ID numérico.');
    }
    await this.prisma.character.update({ where: { id: character.id }, data: { discordId: trimmed } });
    return this.getProfile(code);
  }

  async updateAvatar(code: string, avatarUrl: string) {
    const character = await this.resolveByCode(code);
    await this.prisma.character.update({ where: { id: character.id }, data: { avatarUrl } });
    return this.getProfile(code);
  }

  /** Aplica o nível na hora — print de comprovação é opcional (só fica registrado no histórico, ninguém revisa). */
  async updateLevel(code: string, level: number, proofImageUrl?: string) {
    const character = await this.resolveByCode(code);
    if (!Number.isInteger(level) || level < 1) {
      throw new BadRequestException('Nível inválido.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.character.update({ where: { id: character.id }, data: { level } });
      await tx.levelChangeRequest.create({
        data: { characterId: character.id, level, proofImageUrl: proofImageUrl || null },
      });
    });
    return this.getProfile(code);
  }
}
