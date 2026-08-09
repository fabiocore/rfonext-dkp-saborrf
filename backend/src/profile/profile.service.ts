import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const DISCORD_ID_PATTERN = /^\d{17,19}$/;

/**
 * Perfil self-service do membro, acessado por código de 12 caracteres (sem
 * login) — PREMISSAS.md seção 3. Nível nunca aplica na hora: sempre vira um
 * `LevelChangeRequest` PENDING, porque nível decide elegibilidade em item de
 * leilão com Proteção — precisa de revisão do GM/conselho antes de valer
 * (confirmado com o usuário antes de implementar). Discord ID e avatar
 * aplicam na hora, sem aprovação — sem impacto na elegibilidade/economia.
 */
@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveByCode(code: string) {
    const character = await this.prisma.character.findUnique({ where: { profileAccessCode: code } });
    if (!character) throw new NotFoundException('Código inválido.');
    return character;
  }

  async getProfile(code: string) {
    const character = await this.resolveByCode(code);
    const levelChangeRequests = await this.prisma.levelChangeRequest.findMany({
      where: { characterId: character.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    return {
      character: {
        id: character.id,
        gameName: character.gameName,
        level: character.level,
        discordId: character.discordId,
        avatarUrl: character.avatarUrl,
      },
      levelChangeRequests,
    };
  }

  async updateDiscordId(code: string, discordId: string) {
    const character = await this.resolveByCode(code);
    const trimmed = discordId?.trim();
    if (!trimmed || !DISCORD_ID_PATTERN.test(trimmed)) {
      throw new BadRequestException('ID do Discord inválido — precisa ser só números (17 a 19 dígitos).');
    }
    await this.prisma.character.update({ where: { id: character.id }, data: { discordId: trimmed } });
    return this.getProfile(code);
  }

  async updateAvatar(code: string, avatarUrl: string) {
    const character = await this.resolveByCode(code);
    await this.prisma.character.update({ where: { id: character.id }, data: { avatarUrl } });
    return this.getProfile(code);
  }

  async submitLevelChangeRequest(code: string, requestedLevel: number, proofImageUrl: string) {
    const character = await this.resolveByCode(code);
    if (!Number.isInteger(requestedLevel) || requestedLevel < 1) {
      throw new BadRequestException('Nível inválido.');
    }
    if (!proofImageUrl) {
      throw new BadRequestException('Print de comprovação é obrigatório.');
    }
    const existingPending = await this.prisma.levelChangeRequest.findFirst({
      where: { characterId: character.id, status: 'PENDING' },
    });
    if (existingPending) {
      throw new BadRequestException('Você já tem uma solicitação de nível aguardando revisão.');
    }
    await this.prisma.levelChangeRequest.create({
      data: { characterId: character.id, requestedLevel, proofImageUrl },
    });
    return this.getProfile(code);
  }

  // ---------------------------------------------------------------------
  // Admin (GM/conselho) — fila de aprovação
  // ---------------------------------------------------------------------

  listLevelRequests(status?: 'PENDING' | 'APPROVED' | 'REJECTED') {
    return this.prisma.levelChangeRequest.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
      include: { character: { select: { gameName: true, level: true } } },
    });
  }

  async approveLevelRequest(id: string, reviewerId: string) {
    const request = await this.prisma.levelChangeRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Solicitação não encontrada.');
    if (request.status !== 'PENDING') throw new ForbiddenException('Esta solicitação já foi revisada.');

    return this.prisma.$transaction(async (tx) => {
      await tx.character.update({ where: { id: request.characterId }, data: { level: request.requestedLevel } });
      return tx.levelChangeRequest.update({
        where: { id },
        data: { status: 'APPROVED', reviewedById: reviewerId, reviewedAt: new Date() },
      });
    });
  }

  async rejectLevelRequest(id: string, reviewerId: string, reason: string) {
    if (!reason?.trim()) throw new BadRequestException('Motivo é obrigatório pra rejeitar.');
    const request = await this.prisma.levelChangeRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Solicitação não encontrada.');
    if (request.status !== 'PENDING') throw new ForbiddenException('Esta solicitação já foi revisada.');

    return this.prisma.levelChangeRequest.update({
      where: { id },
      data: { status: 'REJECTED', reviewedById: reviewerId, reviewedAt: new Date(), rejectReason: reason.trim() },
    });
  }
}
