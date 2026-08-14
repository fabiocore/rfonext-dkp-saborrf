import { Test } from '@nestjs/testing';
import { ActivitiesService } from './activities.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Integração de verdade contra o Postgres do ambiente de desenvolvimento
 * (DATABASE_URL do container `api`) — não usa mock de Prisma, porque o
 * ponto central a validar (busca por JANELA de semana civil, não por data
 * exata) é uma query real. Cria/limpa os próprios dados de teste.
 */
describe('ActivitiesService.getRecentWeeklyParticipants (integração)', () => {
  let service: ActivitiesService;
  let prisma: PrismaService;

  let activityId: string;
  let otherActivityId: string;
  let emptyActivityId: string;
  let charInWeekMonday: string;
  let charInWeekThursday: string;
  let charInWeekSunday: string;
  let charOldWeek: string;
  let charLeftGuild: string;

  const WEEK_MONDAY = new Date('2026-08-10T00:00:00.000Z');
  const WEEK_THURSDAY = new Date('2026-08-13T00:00:00.000Z');
  const WEEK_SUNDAY = new Date('2026-08-16T00:00:00.000Z');
  const OLD_WEEK_MONDAY = new Date('2026-08-03T00:00:00.000Z');

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [ActivitiesService, PrismaService],
    }).compile();
    service = moduleRef.get(ActivitiesService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();

    const activity = await prisma.activity.create({
      data: { name: 'IntegTest_RaidSemanal', brcValue: 10, sourceType: 'XML_COLUMN', recurrencePeriod: 'WEEKLY' },
    });
    activityId = activity.id;

    const otherActivity = await prisma.activity.create({
      data: { name: 'IntegTest_Expedicao', brcValue: 8, sourceType: 'XML_COLUMN', recurrencePeriod: 'WEEKLY' },
    });
    otherActivityId = otherActivity.id;

    const emptyActivity = await prisma.activity.create({
      data: { name: 'IntegTest_SemEmissao', brcValue: 5, sourceType: 'XML_COLUMN', recurrencePeriod: 'WEEKLY' },
    });
    emptyActivityId = emptyActivity.id;

    const [c1, c2, c3, c4, c5] = await Promise.all([
      prisma.character.create({ data: { gameName: 'IntegTest_Segunda', status: 'PRINCIPAL', membershipStatus: 'ACTIVE' } }),
      prisma.character.create({ data: { gameName: 'IntegTest_Quinta', status: 'PRINCIPAL', membershipStatus: 'ACTIVE' } }),
      prisma.character.create({ data: { gameName: 'IntegTest_Domingo', status: 'PRINCIPAL', membershipStatus: 'ACTIVE' } }),
      prisma.character.create({ data: { gameName: 'IntegTest_SemanaVelha', status: 'PRINCIPAL', membershipStatus: 'ACTIVE' } }),
      prisma.character.create({ data: { gameName: 'IntegTest_OutraAtividade', status: 'PRINCIPAL', membershipStatus: 'ACTIVE' } }),
    ]);
    charInWeekMonday = c1.id;
    charInWeekThursday = c2.id;
    charInWeekSunday = c3.id;
    charOldWeek = c4.id;
    charLeftGuild = c5.id;

    // Mesma semana (10/08 a 16/08), mas cada personagem com sourceReferenceDate
    // num DIA DIFERENTE dentro dela — exatamente o cenário do "gruda":
    // quem só apareceu marcado num import posterior fica com data diferente
    // de quem apareceu já na segunda, mesmo sendo o mesmo evento da mesma semana.
    await prisma.ledgerTransaction.create({
      data: { characterId: charInWeekMonday, amount: 10, type: 'ACTIVITY_EMISSION', sourceActivityId: activityId, sourceReferenceDate: WEEK_MONDAY },
    });
    await prisma.ledgerTransaction.create({
      data: { characterId: charInWeekThursday, amount: 10, type: 'ACTIVITY_EMISSION', sourceActivityId: activityId, sourceReferenceDate: WEEK_THURSDAY },
    });
    await prisma.ledgerTransaction.create({
      data: { characterId: charInWeekSunday, amount: 10, type: 'ACTIVITY_EMISSION', sourceActivityId: activityId, sourceReferenceDate: WEEK_SUNDAY },
    });
    // Semana anterior — não pode aparecer no resultado (a mais recente é a de 10-16/08).
    await prisma.ledgerTransaction.create({
      data: { characterId: charOldWeek, amount: 10, type: 'ACTIVITY_EMISSION', sourceActivityId: activityId, sourceReferenceDate: OLD_WEEK_MONDAY },
    });
    // Emissão de outra atividade, mesma semana — não pode vazar pro resultado da primeira.
    await prisma.ledgerTransaction.create({
      data: { characterId: charLeftGuild, amount: 8, type: 'ACTIVITY_EMISSION', sourceActivityId: otherActivityId, sourceReferenceDate: WEEK_MONDAY },
    });
  });

  afterAll(async () => {
    await prisma.ledgerTransaction.deleteMany({ where: { sourceActivityId: { in: [activityId, otherActivityId, emptyActivityId] } } });
    await prisma.character.deleteMany({
      where: { gameName: { in: ['IntegTest_Segunda', 'IntegTest_Quinta', 'IntegTest_Domingo', 'IntegTest_SemanaVelha', 'IntegTest_OutraAtividade'] } },
    });
    await prisma.activity.deleteMany({ where: { id: { in: [activityId, otherActivityId, emptyActivityId] } } });
    await prisma.$disconnect();
  });

  it('retorna todo mundo que recebeu a atividade na semana mais recente, mesmo em dias diferentes', async () => {
    const [result] = await service.getRecentWeeklyParticipants([activityId]);
    expect(result.activityId).toBe(activityId);
    expect(result.characterIds.sort()).toEqual([charInWeekMonday, charInWeekThursday, charInWeekSunday].sort());
  });

  it('não inclui quem recebeu numa semana anterior', async () => {
    const [result] = await service.getRecentWeeklyParticipants([activityId]);
    expect(result.characterIds).not.toContain(charOldWeek);
  });

  it('não mistura personagens de outra atividade', async () => {
    const [result] = await service.getRecentWeeklyParticipants([activityId]);
    expect(result.characterIds).not.toContain(charLeftGuild);
  });

  it('calcula a janela da semana corretamente (segunda a segunda seguinte, exclusivo)', async () => {
    const [result] = await service.getRecentWeeklyParticipants([activityId]);
    expect(result.weekStart).toBe(WEEK_MONDAY.toISOString());
    expect(result.weekEnd).toBe(new Date('2026-08-17T00:00:00.000Z').toISOString());
  });

  it('atividade sem nenhuma emissão retorna lista vazia, sem erro', async () => {
    const [result] = await service.getRecentWeeklyParticipants([emptyActivityId]);
    expect(result.characterIds).toEqual([]);
    expect(result.weekStart).toBeNull();
    expect(result.weekEnd).toBeNull();
  });

  it('resolve várias atividades de uma vez, cada uma com sua própria janela', async () => {
    const results = await service.getRecentWeeklyParticipants([activityId, otherActivityId]);
    expect(results).toHaveLength(2);
    const first = results.find((r) => r.activityId === activityId)!;
    const second = results.find((r) => r.activityId === otherActivityId)!;
    expect(first.characterIds.sort()).toEqual([charInWeekMonday, charInWeekThursday, charInWeekSunday].sort());
    expect(second.characterIds).toEqual([charLeftGuild]);
  });
});
