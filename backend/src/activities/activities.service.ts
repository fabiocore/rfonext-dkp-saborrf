import { BadRequestException, Injectable } from '@nestjs/common';
import { Activity } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { periodStartUtc, nextPeriodStartUtc } from '../common/period.util';

@Injectable()
export class ActivitiesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.activity.findMany({
      orderBy: { name: 'asc' },
      include: {
        componentsOf: { include: { componentActivity: true } },
        manualEventBatches: {
          orderBy: { occurrenceDate: 'desc' },
          select: { id: true, occurrenceDate: true, brcValueEach: true, createdAt: true },
        },
      },
    });
  }

  findByName(name: string) {
    return this.prisma.activity.findUnique({ where: { name } });
  }

  /**
   * Chamado pelo ImportService pra cada coluna encontrada num XML. Se a
   * atividade ainda não existe, cria travada (nome = nome da coluna do jogo)
   * com valor 0 — pronta pra uso, sem bloquear a importação
   * (PREMISSAS.md seção 5).
   */
  async ensureXmlColumnActivity(columnName: string): Promise<Activity> {
    const existing = await this.prisma.activity.findUnique({ where: { name: columnName } });
    if (existing) return existing;

    return this.prisma.activity.create({
      data: {
        name: columnName,
        brcValue: 0,
        sourceType: 'XML_COLUMN',
        isNameLocked: true,
      },
    });
  }

  /**
   * GM/conselho pré-cadastra uma atividade que sabe que vai vir do XML (ex:
   * "Raid de Guilda"), com o valor já definido, ANTES do primeiro import
   * real — assim a primeira importação de verdade já emite com o valor
   * certo, em vez de criar a atividade zerada automaticamente e o GM
   * precisar corrigir depois (PREMISSAS.md seção 5/12).
   *
   * Criada travada (isNameLocked/XML_COLUMN) igual a uma atividade
   * auto-detectada, porque é isso que ela vai virar assim que o import
   * bater o nome — e o nome PRECISA ser idêntico, caractere por caractere
   * (maiúsculas, acentos, espaços), ao texto da coluna no XML real: o
   * import casa por igualdade exata (`findByName`/`Activity.name @unique`).
   * Se não bater, o import cria uma segunda atividade (essa sim com o nome
   * certo, mas valor 0) em vez de reaproveitar essa — por isso o resultado
   * de cada import agora lista os nomes de atividade novos detectados
   * (`ImportService.newActivityNames`), pra pegar esse tipo de erro na hora.
   */
  async createKnownActivity(name: string, brcValue: number) {
    const trimmed = name?.trim();
    if (!trimmed) throw new BadRequestException('Nome é obrigatório.');
    const existing = await this.prisma.activity.findUnique({ where: { name: trimmed } });
    if (existing) throw new BadRequestException(`Já existe uma atividade chamada "${trimmed}".`);
    return this.prisma.activity.create({
      data: {
        name: trimmed,
        brcValue: brcValue ?? 0,
        sourceType: 'XML_COLUMN',
        isNameLocked: true,
      },
    });
  }

  async createManual(data: {
    name: string;
    brcValue?: number;
    showOnEventsPanel?: boolean;
    scheduleType?: 'NONE' | 'ONE_TIME' | 'RECURRING';
    scheduleOneTimeAt?: string;
    scheduleWeekdaysUtc?: number[];
    scheduleTimeUtcMinutes?: number;
    imageUrl?: string;
  }) {
    const activity = await this.prisma.activity.create({
      data: {
        name: data.name,
        brcValue: data.brcValue ?? 0,
        sourceType: 'MANUAL',
        isNameLocked: false,
        showOnEventsPanel: data.showOnEventsPanel ?? false,
        scheduleType: data.scheduleType ?? 'NONE',
        scheduleOneTimeAt: data.scheduleOneTimeAt ? new Date(data.scheduleOneTimeAt) : null,
        scheduleWeekdaysUtc: data.scheduleWeekdaysUtc ?? [],
        scheduleTimeUtcMinutes: data.scheduleTimeUtcMinutes,
        imageUrl: data.imageUrl,
      },
    });
    return activity;
  }

  async update(
    id: string,
    data: {
      brcValue?: number;
      name?: string; // só é aplicado se a atividade não tiver nome travado
      showOnEventsPanel?: boolean;
      scheduleType?: 'NONE' | 'ONE_TIME' | 'RECURRING';
      scheduleOneTimeAt?: string | null;
      scheduleWeekdaysUtc?: number[];
      scheduleTimeUtcMinutes?: number | null;
      imageUrl?: string | null;
      isActive?: boolean;
      recurrencePeriod?: 'DAILY' | 'WEEKLY' | 'MONTHLY';
      maxOccurrencesPerPeriod?: number;
    },
  ) {
    const current = await this.prisma.activity.findUniqueOrThrow({ where: { id } });
    if (data.maxOccurrencesPerPeriod !== undefined && data.maxOccurrencesPerPeriod < 1) {
      throw new BadRequestException('Quantas vezes por período precisa ser pelo menos 1.');
    }
    const patch: Record<string, unknown> = { ...data };
    if (current.isNameLocked) {
      delete patch.name;
    }
    if (data.scheduleOneTimeAt !== undefined) {
      patch.scheduleOneTimeAt = data.scheduleOneTimeAt ? new Date(data.scheduleOneTimeAt) : null;
    }
    // Nunca emite retroativamente aqui — mudar o valor (ou reativar) só troca
    // a régua vigente pros PRÓXIMOS imports; dias já importados não são
    // reprocessados (PREMISSAS.md seção 5).
    return this.prisma.activity.update({ where: { id }, data: patch });
  }

  /** Define quais Activities-coluna precisam estar TODAS marcadas pra uma Activity composta emitir. */
  async setComponents(compositeActivityId: string, componentActivityIds: string[]) {
    await this.prisma.activityComponent.deleteMany({ where: { compositeActivityId } });
    if (componentActivityIds.length === 0) {
      return this.prisma.activity.update({
        where: { id: compositeActivityId },
        data: { isComposite: false },
      });
    }
    await this.prisma.activityComponent.createMany({
      data: componentActivityIds.map((componentActivityId) => ({
        compositeActivityId,
        componentActivityId,
      })),
    });
    // Idem: definir os componentes só vale pros próximos imports, nunca
    // reprocessa check-ins já importados.
    return this.prisma.activity.update({
      where: { id: compositeActivityId },
      data: { isComposite: true },
    });
  }

  /** Todas as atividades compostas, com a lista de Activities-coluna que as compõem. */
  listComposites() {
    return this.prisma.activity.findMany({
      where: { isComposite: true },
      include: { componentsOf: { include: { componentActivity: true } } },
    });
  }

  /**
   * Pra cada atividade pedida, acha a SEMANA CIVIL mais recente que teve
   * emissão (`ACTIVITY_EMISSION`) e devolve quem recebeu BRC dela — usado
   * na criação de leilão pra pré-marcar participantes de eventos semanais
   * (Raid de Guilda etc.) sem precisar checar um por um manualmente
   * (PREMISSAS.md seção 7). Busca por JANELA de semana (segunda a domingo),
   * não por data exata: o "checked" do jogo gruda em todo import até o
   * reset semanal, então dois personagens do mesmo evento podem ter
   * `sourceReferenceDate` em dias diferentes dentro da mesma semana,
   * dependendo de qual import cada um apareceu marcado pela primeira vez
   * (mesma regra de `LedgerService.canEmitPeriodic`, reaproveitando
   * `periodStartUtc`/`nextPeriodStartUtc` pra ficar garantidamente
   * consistente com o que decide "isso é uma emissão nova ou a mesma
   * ocorrência de novo"). Atividade sem nenhuma emissão ainda devolve lista
   * vazia (`weekStart`/`weekEnd` nulos), sem erro.
   */
  async getRecentWeeklyParticipants(activityIds: string[]) {
    const activities = await this.prisma.activity.findMany({
      where: { id: { in: activityIds } },
      select: { id: true, name: true },
    });
    const nameById = new Map(activities.map((a) => [a.id, a.name]));

    return Promise.all(
      activityIds.map(async (activityId) => {
        const latest = await this.prisma.ledgerTransaction.findFirst({
          where: { sourceActivityId: activityId, type: 'ACTIVITY_EMISSION' },
          orderBy: { sourceReferenceDate: 'desc' },
          select: { sourceReferenceDate: true },
        });

        if (!latest?.sourceReferenceDate) {
          return { activityId, activityName: nameById.get(activityId) ?? '', weekStart: null, weekEnd: null, characterIds: [] };
        }

        const weekStart = periodStartUtc('WEEKLY', latest.sourceReferenceDate);
        const weekEnd = nextPeriodStartUtc('WEEKLY', weekStart);

        const emissions = await this.prisma.ledgerTransaction.findMany({
          where: {
            sourceActivityId: activityId,
            type: 'ACTIVITY_EMISSION',
            sourceReferenceDate: { gte: weekStart, lt: weekEnd },
          },
          select: { characterId: true },
          distinct: ['characterId'],
        });

        return {
          activityId,
          activityName: nameById.get(activityId) ?? '',
          weekStart: weekStart.toISOString(),
          weekEnd: weekEnd.toISOString(),
          characterIds: emissions.map((e) => e.characterId),
        };
      }),
    );
  }

  /** Painel público de eventos — puramente informativo (PREMISSAS.md seção 5). */
  listPublicEvents() {
    return this.prisma.activity.findMany({
      where: { isActive: true, showOnEventsPanel: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        brcValue: true,
        scheduleType: true,
        scheduleOneTimeAt: true,
        scheduleWeekdaysUtc: true,
        scheduleTimeUtcMinutes: true,
        imageUrl: true,
      },
    });
  }
}
