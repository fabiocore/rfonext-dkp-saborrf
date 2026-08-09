import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Character } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { generateProfileAccessCode } from '../profile/profile-code.util';
import { isValidDiscordHandle } from '../common/discord-handle.util';

@Injectable()
export class CharactersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    await this.ensureAllPrincipalsHaveProfileCodes();
    const [characters, sums] = await Promise.all([
      this.prisma.character.findMany({ orderBy: { gameName: 'asc' } }),
      this.prisma.ledgerTransaction.groupBy({ by: ['characterId'], _sum: { amount: true } }),
    ]);
    const balanceByCharacter = new Map(sums.map((s) => [s.characterId, s._sum.amount ?? 0]));
    return characters.map((c) => ({ ...c, balance: balanceByCharacter.get(c.id) ?? 0 }));
  }

  /**
   * Todo Principal precisa de um código de perfil (12 caracteres,
   * distribuído manualmente pelo GM/conselho — mesmo padrão do código de
   * leilão). Gera pra quem ainda não tem (personagem novo, ou promovido de
   * Alt pra Principal) — idempotente, autocorretivo, sem precisar de
   * migração de dados nem botão manual separado.
   */
  private async ensureAllPrincipalsHaveProfileCodes(): Promise<void> {
    const missing = await this.prisma.character.findMany({
      where: { status: 'PRINCIPAL', profileAccessCode: null },
      select: { id: true },
    });
    for (const { id } of missing) {
      await this.prisma.character.update({ where: { id }, data: { profileAccessCode: await this.uniqueProfileCode() } });
    }
  }

  private async uniqueProfileCode(): Promise<string> {
    let code = generateProfileAccessCode();
    for (let attempt = 0; attempt < 5; attempt++) {
      const clash = await this.prisma.character.findUnique({ where: { profileAccessCode: code } });
      if (!clash) break;
      code = generateProfileAccessCode();
    }
    return code;
  }

  /**
   * GM/conselho pode gerar um código novo a qualquer momento (ex: suspeita
   * de vazamento, membro perdeu o antigo) — o código anterior para de
   * funcionar na hora, já que é sobrescrito.
   */
  async regenerateProfileAccessCode(id: string) {
    const character = await this.prisma.character.findUnique({ where: { id } });
    if (!character) throw new NotFoundException('Personagem não encontrado.');
    if (character.status !== 'PRINCIPAL') {
      throw new BadRequestException('Só Principal tem código de perfil.');
    }
    return this.prisma.character.update({
      where: { id },
      data: { profileAccessCode: await this.uniqueProfileCode() },
    });
  }

  /**
   * Marca como LEFT ("Saiu") todo personagem que não apareceu no XML mais
   * recente — sobrescreve ACTIVE ou UNKNOWN, já que ausência do arquivo é um
   * fato objetivo (diferente de UNKNOWN, que é julgamento manual). Chamado
   * pelo ImportService depois de processar as linhas do arquivo.
   */
  async markMissingAsLeft(gameNamesInFile: string[]): Promise<number> {
    const result = await this.prisma.character.updateMany({
      where: {
        gameName: { notIn: gameNamesInFile },
        membershipStatus: { not: 'LEFT' },
      },
      data: { membershipStatus: 'LEFT' },
    });
    return result.count;
  }

  findById(id: string) {
    return this.prisma.character.findUnique({ where: { id } });
  }

  /**
   * Chamado pelo ImportService pra cada linha de um XML importado.
   * Cria o personagem na primeira vez que ele aparece (como PRINCIPAL e
   * membershipStatus ACTIVE por padrão), ou só atualiza lastSeenAt se já
   * existir. Ter check nas atividades não prova interação real com a guild
   * — por isso ACTIVE/UNKNOWN NUNCA são tocados automaticamente depois da
   * criação; só GM/conselho alterna entre eles (ver PREMISSAS.md seção 3).
   * Exceção: se o personagem estava LEFT ("Saiu") e reaparece num XML, volta
   * pra ACTIVE sozinho — reaparecer no arquivo é prova objetiva de retorno.
   */
  async upsertFromImport(gameName: string, referenceDate: Date): Promise<Character> {
    const existing = await this.prisma.character.findUnique({ where: { gameName } });

    if (!existing) {
      return this.prisma.character.create({
        data: {
          gameName,
          membershipStatus: 'ACTIVE',
          firstSeenAt: referenceDate,
          lastSeenAt: referenceDate,
        },
      });
    }

    return this.prisma.character.update({
      where: { id: existing.id },
      data: {
        lastSeenAt: referenceDate > existing.lastSeenAt ? referenceDate : existing.lastSeenAt,
        ...(existing.membershipStatus === 'LEFT' ? { membershipStatus: 'ACTIVE' as const } : {}),
      },
    });
  }

  async updateProfile(
    id: string,
    data: {
      status?: 'PRINCIPAL' | 'ALT' | 'ALT_ONLY';
      level?: number | null;
      linkedPrincipalId?: string | null;
      membershipStatus?: 'ACTIVE' | 'UNKNOWN' | 'LEFT';
      notes?: string | null;
      discordId?: string | null;
      linkedUserId?: string | null;
    },
  ) {
    // level e vínculo de conta só fazem sentido pra Principal (só ele tem
    // perfil público self-service); limpos automaticamente nos outros casos.
    const patch: typeof data = { ...data };
    if (patch.status && patch.status !== 'PRINCIPAL') {
      patch.level = null;
      patch.linkedUserId = null;
    }
    if (patch.status && patch.status !== 'ALT') {
      patch.linkedPrincipalId = null;
    }
    if (patch.linkedUserId) {
      const account = await this.prisma.user.findUnique({ where: { id: patch.linkedUserId } });
      if (!account) throw new NotFoundException('Conta não encontrada.');
      const alreadyLinked = await this.prisma.character.findUnique({ where: { linkedUserId: patch.linkedUserId } });
      if (alreadyLinked && alreadyLinked.id !== id) {
        throw new BadRequestException(`Essa conta já está vinculada a "${alreadyLinked.gameName}".`);
      }
    }
    if (patch.discordId !== undefined && patch.discordId !== null && patch.discordId !== '') {
      if (!isValidDiscordHandle(patch.discordId)) {
        throw new BadRequestException('Discord inválido — use seu usuário (ex: fulano ou fulano#1234) ou o ID numérico.');
      }
    } else if (patch.discordId === '') {
      patch.discordId = null;
    }

    return this.prisma.character.update({ where: { id }, data: patch });
  }
}
