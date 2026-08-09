import { BadRequestException, Injectable } from '@nestjs/common';
import { LedgerTransactionType, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Início (00:00 UTC) do período civil (semana ou mês) que contém `date` —
 * usado pra agrupar atividades WEEKLY/MONTHLY. `date` é sempre um
 * referenceDate (data-só, meia-noite UTC), então o corte é por dia
 * calendário, não pelo horário exato das 07h GMT-3 do reset real do jogo
 * (o dado de origem não tem granularidade de hora pra ser mais preciso).
 * Semana = segunda a domingo. Mês = dia 1º ao último dia do mês.
 */
function periodStartUtc(period: 'WEEKLY' | 'MONTHLY', date: Date): Date {
  if (period === 'MONTHLY') {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  }
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay(); // 0=domingo..6=sábado
  const diffToMonday = (day + 6) % 7; // segunda=0, terça=1, ..., domingo=6
  d.setUTCDate(d.getUTCDate() - diffToMonday);
  return d;
}

/** Início (00:00 UTC) do período civil SEGUINTE a `periodStart` — fim exclusivo do range. */
function nextPeriodStartUtc(period: 'WEEKLY' | 'MONTHLY', periodStart: Date): Date {
  const d = new Date(periodStart);
  if (period === 'MONTHLY') {
    d.setUTCMonth(d.getUTCMonth() + 1);
  } else {
    d.setUTCDate(d.getUTCDate() + 7);
  }
  return d;
}

@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Quem pode receber BRC: só Principal com membershipStatus ACTIVE. Ter
   * check nas atividades do jogo não prova interação real — por isso
   * "Desconhecido" (setado manualmente por GM/conselho) para de receber BRC
   * mesmo que continue aparecendo nos imports (PREMISSAS.md seção 3).
   */
  private async getEligibleCharacterIds(): Promise<Set<string>> {
    const characters = await this.prisma.character.findMany({
      where: { status: 'PRINCIPAL', membershipStatus: 'ACTIVE' },
      select: { id: true },
    });
    return new Set(characters.map((c) => c.id));
  }

  async getBalance(characterId: string): Promise<number> {
    const result = await this.prisma.ledgerTransaction.aggregate({
      where: { characterId },
      _sum: { amount: true },
    });
    return result._sum.amount ?? 0;
  }

  /**
   * Soma os lances em que o personagem está liderando (ou empatado) em
   * itens de leilão abertos — esse valor está "reservado", não deve ser
   * tributado nem contado como disponível pra novos lances (PREMISSAS.md
   * seção 4/7). Versão somente-leitura; a checagem de concorrência real na
   * hora de dar lance vive em AuctionsService (precisa rodar sob advisory
   * lock, na mesma transação).
   */
  private async computeAuctionHold(characterId: string): Promise<number> {
    const openItems = await this.prisma.auctionItem.findMany({
      where: { auction: { status: 'OPEN', expiresAt: { gt: new Date() } }, resolutionStatus: 'PENDING' },
      select: {
        bids: { select: { characterId: true, amount: true } },
        withdrawals: { select: { characterId: true } },
      },
    });

    let hold = 0;
    for (const item of openItems) {
      const withdrawnIds = new Set(item.withdrawals.map((w) => w.characterId));
      const activeBids = item.bids.filter((b) => !withdrawnIds.has(b.characterId));
      if (activeBids.length === 0) continue;
      const leadingAmount = activeBids.reduce((max, b) => Math.max(max, b.amount), 0);
      const ownBest = activeBids
        .filter((b) => b.characterId === characterId)
        .reduce((max, b) => Math.max(max, b.amount), 0);
      if (ownBest > 0 && ownBest === leadingAmount) hold += leadingAmount;
    }
    return hold;
  }

  /**
   * Trava de segurança do lado do servidor: transferência, evento manual e
   * emissão manual do GM só podem mexer em personagens elegíveis pra BRC
   * (Principal + Ativo na Guild) — a UI já filtra os dropdowns pra isso, mas
   * isso sozinho não impede uma chamada direta à API. Nunca confiar só no
   * filtro do frontend pra uma regra financeira.
   */
  private async assertCharactersEligibleForBrc(characterIds: string[]) {
    const eligible = await this.getEligibleCharacterIds();
    const ineligibleIds = [...new Set(characterIds)].filter((id) => !eligible.has(id));
    if (ineligibleIds.length === 0) return;

    const ineligibleCharacters = await this.prisma.character.findMany({
      where: { id: { in: ineligibleIds } },
      select: { gameName: true },
    });
    const label = ineligibleCharacters.map((c) => c.gameName).join(', ') || ineligibleIds.join(', ');
    throw new BadRequestException(
      `Só é possível transferir/emitir/queimar BRC para personagens Principal e "Ativo na Guild". Não elegível: ${label}.`,
    );
  }

  async getAvailableBalance(characterId: string): Promise<number> {
    const [balance, hold] = await Promise.all([this.getBalance(characterId), this.computeAuctionHold(characterId)]);
    return balance - hold;
  }

  /**
   * Corte semanal: queima weeklyTaxPercent% do saldo DISPONÍVEL de cada
   * Principal (nunca do valor já reservado em lances líderes de leilões
   * abertos — evitar isso é o que garante que uma vitória de leilão nunca
   * vai tentar debitar mais do que existe). PREMISSAS.md seção 4.
   *
   * Arredondamento: a moeda é sempre inteira, então "10% de 106" (10,6)
   * precisa virar um número inteiro. Regra combinada com o usuário: acima
   * de x,5 arredonda pra cima (10,6 → 11); em x,5 exato ou abaixo arredonda
   * pra baixo (10,5 → 10; 10,4 → 10). Calculado em inteiros puros
   * (numerator % 100) pra não depender de ponto flutuante na hora de
   * decidir o lado do arredondamento.
   *
   * Disparo automático (cron, sem `options`) ou manual (GM, com motivo
   * obrigatório — `options.manual`) usam exatamente a mesma lógica; a
   * única diferença é o registro de quem/por quê no WeeklyTaxRun e nas
   * transações geradas, pra auditoria.
   */
  async runWeeklyTax(options?: { manual?: boolean; reason?: string; triggeredById?: string }) {
    if (options?.manual && !options.reason?.trim()) {
      throw new BadRequestException('Motivo é obrigatório pra rodar o corte semanal manualmente.');
    }

    const guildSettings = await this.prisma.guildSettings.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1, guildName: 'Minha Guild' },
    });

    const principals = await this.prisma.character.findMany({
      where: { status: 'PRINCIPAL' },
      select: { id: true },
    });

    const reason = options?.manual ? options.reason!.trim() : null;

    const run = await this.prisma.weeklyTaxRun.create({
      data: {
        percentApplied: guildSettings.weeklyTaxPercent,
        triggeredManually: options?.manual ?? false,
        reason,
        triggeredById: options?.manual ? (options.triggeredById ?? null) : null,
      },
    });

    let totalCharactersTaxed = 0;
    let totalAmountBurned = 0;

    for (const { id: characterId } of principals) {
      const available = await this.getAvailableBalance(characterId);
      const numerator = available * guildSettings.weeklyTaxPercent;
      const remainder = numerator % 100;
      const taxAmount = remainder > 50 ? Math.floor(numerator / 100) + 1 : Math.floor(numerator / 100);
      if (taxAmount <= 0) continue;

      await this.prisma.ledgerTransaction.create({
        data: {
          characterId,
          amount: -taxAmount,
          type: 'WEEKLY_TAX_BURN',
          weeklyTaxRunId: run.id,
          reasonText: reason,
          createdById: options?.manual ? (options.triggeredById ?? null) : null,
        },
      });
      totalCharactersTaxed++;
      totalAmountBurned += taxAmount;
    }

    return this.prisma.weeklyTaxRun.update({
      where: { id: run.id },
      data: { totalCharactersTaxed, totalAmountBurned },
    });
  }

  /** Histórico de cortes semanais (automáticos e manuais) — pra o GM decidir com informação se vale rodar de novo. */
  listWeeklyTaxRuns(limit = 20) {
    return this.prisma.weeklyTaxRun.findMany({
      orderBy: { executedAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Saldo público de todos os Principais elegíveis pra BRC — não é uma
   * disputa/ranking, então a ordem é alfabética por personagem, não por
   * saldo (correção de 2026-08-09: antes ordenava por saldo desc, o que
   * passava a ideia errada de competição). Personagens "Desconhecido" não
   * aparecem aqui (correção de 2026-08-09: não faz sentido poluir a lista
   * com quem não recebe BRC no momento) — o histórico deles continua
   * intacto no extrato, só não sai na listagem principal.
   */
  async getBalances(params: { page?: number; pageSize?: number } = {}) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 25));
    const where = { status: 'PRINCIPAL' as const, membershipStatus: 'ACTIVE' as const };

    const [principals, total] = await Promise.all([
      this.prisma.character.findMany({
        where,
        select: { id: true, gameName: true, level: true, membershipStatus: true },
        orderBy: { gameName: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.character.count({ where }),
    ]);

    const sums = await this.prisma.ledgerTransaction.groupBy({
      by: ['characterId'],
      _sum: { amount: true },
      where: { characterId: { in: principals.map((p) => p.id) } },
    });
    const balanceByCharacter = new Map(sums.map((s) => [s.characterId, s._sum.amount ?? 0]));

    return {
      items: principals.map((c) => ({ ...c, balance: balanceByCharacter.get(c.id) ?? 0 })),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  /** Extrato completo de um personagem (uso interno / futura tela de detalhe). */
  getTransactionsForCharacter(characterId: string) {
    return this.prisma.ledgerTransaction.findMany({
      where: { characterId },
      orderBy: { createdAt: 'desc' },
      include: { sourceActivity: true },
    });
  }

  /**
   * Feed público de transferências e emissões manuais do GM (PREMISSAS.md
   * seção 9) — sempre com print quando anexado. Paginado (25 por página) e
   * filtrável por personagem, pra ficar navegável mesmo com muito histórico.
   */
  async getPublicFeed(
    params: { page?: number; pageSize?: number; characterId?: string; fromDate?: string; toDate?: string } = {},
  ) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 25));

    // Data-só (sem hora), mesma convenção usada em ImportBatch/ActivityCheckIn —
    // interpretada em UTC, sem conversão de fuso do navegador.
    const createdAtFilter: { gte?: Date; lte?: Date } = {};
    if (params.fromDate) createdAtFilter.gte = new Date(`${params.fromDate}T00:00:00.000Z`);
    if (params.toDate) createdAtFilter.lte = new Date(`${params.toDate}T23:59:59.999Z`);

    const where = {
      type: {
        in: [
          'TRANSFER_OUT',
          'GM_MANUAL_ADJUSTMENT',
          'MANUAL_EVENT_EMISSION',
          'ACTIVITY_EMISSION',
          'WEEKLY_TAX_BURN',
          'AUCTION_WIN_REVERSAL',
        ] as LedgerTransactionType[],
      },
      ...(params.characterId ? { characterId: params.characterId } : {}),
      ...(Object.keys(createdAtFilter).length > 0 ? { createdAt: createdAtFilter } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.ledgerTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { character: { select: { gameName: true } }, sourceActivity: { select: { name: true } } },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.ledgerTransaction.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  /**
   * Emite BRC pelas atividades marcadas num lote de importação: para cada
   * personagem+dia do lote, avalia toda atividade simples (XML_COLUMN, não
   * composta) marcada como checked, e toda atividade composta cujos
   * componentes estejam TODOS marcados no mesmo dia (PREMISSAS.md seção 2/5).
   * Idempotente: nunca emite duas vezes pro mesmo (personagem, atividade, dia).
   *
   * `recurrencePeriod` decide COMO interpretar "checked" (corrigido em
   * 2026-08-09, depois de descobrir um bug real de pagamento em dobro, e
   * generalizado no mesmo dia pra suportar qualquer número de ocorrências
   * por período, não só 1x):
   * - `DAILY`: o "checked" reflete o dia específico — emite toda vez que
   *   aparecer true (Verificado, Doar, Atividade da Guilda, e a composta
   *   "Diária" que os agrega — resetam todo dia, confirmado pelo GM).
   * - `WEEKLY`/`MONTHLY`: todas as outras atividades do jogo — não
   *   resetam todo dia, e sim semanalmente (toda segunda-feira) ou
   *   mensalmente (todo dia 1º), sempre às 07h GMT-3 (regra fixa do jogo,
   *   confirmada pelo GM, não configurável por atividade). Emite no
   *   máximo `maxOccurrencesPerPeriod` vezes dentro do período — 1 é o
   *   caso comum (Raid de Guilda etc.), mas suporta 2, 3... pra atividades
   *   futuras com mais de uma ocorrência no mesmo período. Duas checagens
   *   combinadas (`canEmitPeriodic`): (1) o dia de hoje precisa ser uma
   *   ocorrência NOVA (dia anterior mais recente com registro não estava
   *   marcado — evita contar dias "grudados" do mesmo evento como
   *   ocorrências separadas); (2) o total de emissões já feitas dentro do
   *   período atual precisa estar abaixo do limite configurado.
   */
  async recordActivityEmissionsForBatch(importBatchId: string) {
    const checkIns = await this.prisma.activityCheckIn.findMany({
      where: { importBatchId },
      select: { characterId: true, referenceDate: true },
      distinct: ['characterId', 'referenceDate'],
    });

    const [simpleActivities, compositeActivities, eligibleCharacterIds] = await Promise.all([
      this.prisma.activity.findMany({
        where: { isComposite: false, isActive: true, sourceType: 'XML_COLUMN' },
      }),
      this.prisma.activity.findMany({
        where: { isComposite: true, isActive: true },
        include: { componentsOf: { include: { componentActivity: true } } },
      }),
      this.getEligibleCharacterIds(),
    ]);

    let emittedCount = 0;

    for (const { characterId, referenceDate } of checkIns) {
      if (!eligibleCharacterIds.has(characterId)) continue; // não-Principal ou "Desconhecido" não recebe BRC

      const dayCheckIns = await this.prisma.activityCheckIn.findMany({
        where: { characterId, referenceDate },
      });
      const checkedActivityIds = new Set(dayCheckIns.filter((c) => c.checked).map((c) => c.activityId));

      for (const activity of simpleActivities) {
        if (!checkedActivityIds.has(activity.id) || activity.brcValue <= 0) continue;
        if (activity.recurrencePeriod !== 'DAILY') {
          const canEmit = await this.canEmitPeriodic(
            characterId,
            activity.id,
            [activity.id],
            referenceDate,
            activity.recurrencePeriod,
            activity.maxOccurrencesPerPeriod,
          );
          if (!canEmit) continue;
        }
        await this.emitOnce({
          characterId,
          activityId: activity.id,
          referenceDate,
          amount: activity.brcValue,
        });
        emittedCount++;
      }

      for (const composite of compositeActivities) {
        if (composite.brcValue <= 0 || composite.componentsOf.length === 0) continue;
        const componentIds = composite.componentsOf.map((c) => c.componentActivityId);
        const allComponentsChecked = componentIds.every((id) => checkedActivityIds.has(id));
        if (!allComponentsChecked) continue;
        if (composite.recurrencePeriod !== 'DAILY') {
          const canEmit = await this.canEmitPeriodic(
            characterId,
            composite.id,
            componentIds,
            referenceDate,
            composite.recurrencePeriod,
            composite.maxOccurrencesPerPeriod,
          );
          if (!canEmit) continue;
        }
        await this.emitOnce({
          characterId,
          activityId: composite.id,
          referenceDate,
          amount: composite.brcValue,
        });
        emittedCount++;
      }
    }

    return { emittedCount };
  }

  /**
   * Pra atividades WEEKLY/MONTHLY: decide se dá pra emitir hoje, combinando
   * duas checagens independentes:
   * 1. Hoje precisa ser uma ocorrência NOVA **dentro do período atual** —
   *    o dia anterior mais recente com registro de check-in **DESSE MESMO
   *    período** (semana ou mês; nunca olha pra trás de um período
   *    anterior) não pode estar marcado. Isso evita contar dias "grudados"
   *    do mesmo evento (o "checked" não reseta todo dia — ver
   *    `recordActivityEmissionsForBatch`) como ocorrências separadas —
   *    mas ao mesmo tempo garante que cruzar a fronteira do período
   *    (nova semana/mês) sempre libera uma emissão nova, mesmo que o
   *    "checked" do período anterior ainda estivesse true (bug real
   *    encontrado e corrigido em 2026-08-09: sem limitar ao período atual,
   *    um "checked" que nunca voltou a false no período anterior bloqueava
   *    a emissão do período seguinte pra sempre).
   * 2. O total de emissões já feitas dentro do período civil atual
   *    precisa estar abaixo de `maxOccurrencesPerPeriod` — baseado nas
   *    transações JÁ emitidas, não no histórico de check-in, então
   *    funciona mesmo com lacunas de importação.
   */
  private async canEmitPeriodic(
    characterId: string,
    activityId: string,
    checkedComponentIds: string[],
    referenceDate: Date,
    period: 'WEEKLY' | 'MONTHLY',
    maxOccurrencesPerPeriod: number,
  ): Promise<boolean> {
    const start = periodStartUtc(period, referenceDate);
    const end = nextPeriodStartUtc(period, start);

    const priorCheckIns = await this.prisma.activityCheckIn.findMany({
      where: {
        characterId,
        activityId: { in: checkedComponentIds },
        referenceDate: { gte: start, lt: referenceDate }, // só dentro do MESMO período — nunca olha pra período anterior
      },
      orderBy: { referenceDate: 'desc' },
    });
    if (priorCheckIns.length > 0) {
      const mostRecentPriorDate = priorCheckIns[0].referenceDate;
      const mostRecentPriorCheckIns = priorCheckIns.filter(
        (c) => c.referenceDate.getTime() === mostRecentPriorDate.getTime(),
      );
      const wasAlreadySatisfied =
        mostRecentPriorCheckIns.length === checkedComponentIds.length && mostRecentPriorCheckIns.every((c) => c.checked);
      if (wasAlreadySatisfied) return false; // continuação da mesma ocorrência, nunca emite de novo
    }

    const emittedThisPeriod = await this.prisma.ledgerTransaction.count({
      where: {
        characterId,
        sourceActivityId: activityId,
        type: 'ACTIVITY_EMISSION',
        sourceReferenceDate: { gte: start, lt: end },
      },
    });
    return emittedThisPeriod < maxOccurrencesPerPeriod;
  }


  private async emitOnce(params: {
    characterId: string;
    activityId: string;
    referenceDate: Date;
    amount: number;
  }) {
    const already = await this.prisma.ledgerTransaction.findFirst({
      where: {
        characterId: params.characterId,
        sourceActivityId: params.activityId,
        sourceReferenceDate: params.referenceDate,
        type: 'ACTIVITY_EMISSION',
      },
    });
    if (already) return;

    await this.prisma.ledgerTransaction.create({
      data: {
        characterId: params.characterId,
        amount: params.amount,
        type: 'ACTIVITY_EMISSION',
        sourceActivityId: params.activityId,
        sourceReferenceDate: params.referenceDate,
      },
    });
  }

  /**
   * Evento manual com print — credita o mesmo valor pra vários Principais
   * selecionados. `activityId` opcional liga a emissão a um Evento
   * Personalizado já cadastrado/agendado na tela Eventos Personalizados
   * (PREMISSAS.md seção 5), mantendo o histórico rastreável até o evento
   * divulgado no site — mas continua aceitando bônus avulsos sem evento
   * formal. `occurrenceDate` identifica qual ocorrência está sendo paga
   * (obrigatório junto de `activityId`, pra impedir pagar a mesma ocorrência
   * duas vezes); se o evento não for recorrente, distribuir também encerra
   * ele automaticamente (só existe 1 ocorrência possível). Evento recorrente
   * só encerra via ação explícita separada (`ActivitiesService.update`).
   */
  async recordManualEventBatch(params: {
    title: string;
    brcValueEach: number;
    proofImageUrl: string;
    createdById: string;
    characterIds: string[];
    activityId?: string | null;
    occurrenceDate?: string | null;
  }) {
    if (params.characterIds.length === 0) {
      throw new BadRequestException('Selecione ao menos um personagem participante.');
    }
    let activity: { id: string; scheduleType: string } | null = null;
    if (params.activityId) {
      activity = await this.prisma.activity.findUnique({
        where: { id: params.activityId },
        select: { id: true, scheduleType: true },
      });
      if (!activity) {
        throw new BadRequestException('Evento selecionado não existe.');
      }
    }
    await this.assertCharactersEligibleForBrc(params.characterIds);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const batch = await tx.manualEventBatch.create({
          data: {
            activityId: params.activityId || null,
            occurrenceDate: params.occurrenceDate ? new Date(params.occurrenceDate) : null,
            title: params.title,
            brcValueEach: params.brcValueEach,
            proofImageUrl: params.proofImageUrl,
            createdById: params.createdById,
          },
        });
        for (const characterId of params.characterIds) {
          await tx.ledgerTransaction.create({
            data: {
              characterId,
              amount: params.brcValueEach,
              type: 'MANUAL_EVENT_EMISSION',
              manualEventBatchId: batch.id,
              createdById: params.createdById,
            },
          });
        }
        if (activity && activity.scheduleType !== 'RECURRING') {
          await tx.activity.update({ where: { id: activity.id }, data: { isActive: false } });
        }
        return batch;
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new BadRequestException(
          'Essa ocorrência já foi distribuída antes (mesma data). Escolha outra data ou confira o histórico do evento.',
        );
      }
      throw err;
    }
  }

  /** Transferência entre dois membros — neutra, sempre com print (PREMISSAS.md seção 4). */
  async recordTransfer(params: {
    fromCharacterId: string;
    toCharacterId: string;
    amount: number;
    proofImageUrl: string;
    reasonText?: string;
    createdById: string;
  }) {
    if (params.amount <= 0) {
      throw new BadRequestException('O valor da transferência deve ser positivo.');
    }
    await this.assertCharactersEligibleForBrc([params.fromCharacterId, params.toCharacterId]);

    // Checagem explícita além da trigger de banco (que também bloquearia,
    // mas com um erro cru de SQL) — dá uma mensagem clara pro GM/conselho.
    const fromBalance = await this.getBalance(params.fromCharacterId);
    if (params.amount > fromBalance) {
      throw new BadRequestException(`Saldo insuficiente pra essa transferência. Saldo atual: ${fromBalance}.`);
    }

    const transferGroupId = randomUUID();

    return this.prisma.$transaction(async (tx) => {
      await tx.ledgerTransaction.create({
        data: {
          characterId: params.fromCharacterId,
          amount: -params.amount,
          type: 'TRANSFER_OUT',
          proofImageUrl: params.proofImageUrl,
          reasonText: params.reasonText,
          createdById: params.createdById,
          transferGroupId,
        },
      });
      return tx.ledgerTransaction.create({
        data: {
          characterId: params.toCharacterId,
          amount: params.amount,
          type: 'TRANSFER_IN',
          proofImageUrl: params.proofImageUrl,
          reasonText: params.reasonText,
          createdById: params.createdById,
          transferGroupId,
        },
      });
    });
  }

  /**
   * Emissão Manual do GM — crédito ou débito (queima) avulso num único
   * membro (ou vários de uma vez), motivo obrigatório, print opcional.
   * GM-only (checagem de papel fica no guard do controller, Fase 2).
   * PREMISSAS.md seção 4/8. Um GM_MANUAL_ADJUSTMENT por personagem, todos
   * com o mesmo valor/motivo/print — criados numa única transação de banco
   * pra não deixar metade aplicada se algo falhar no meio.
   */
  async recordGmManualAdjustment(params: {
    characterIds: string[];
    amount: number;
    reasonText: string;
    proofImageUrl?: string;
    createdById: string;
  }) {
    if (params.characterIds.length === 0) {
      throw new BadRequestException('Selecione ao menos um personagem.');
    }
    if (!params.reasonText?.trim()) {
      throw new BadRequestException('Motivo é obrigatório.');
    }
    if (params.amount === 0) {
      throw new BadRequestException('O valor deve ser diferente de zero.');
    }
    await this.assertCharactersEligibleForBrc(params.characterIds);
    return this.prisma.$transaction((tx) =>
      Promise.all(
        params.characterIds.map((characterId) =>
          tx.ledgerTransaction.create({
            data: {
              characterId,
              amount: params.amount,
              type: 'GM_MANUAL_ADJUSTMENT' as LedgerTransactionType,
              reasonText: params.reasonText,
              proofImageUrl: params.proofImageUrl,
              createdById: params.createdById,
            },
          }),
        ),
      ),
    );
  }
}
