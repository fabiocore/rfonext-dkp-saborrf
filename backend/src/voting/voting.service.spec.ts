import { Test } from '@nestjs/testing';
import { VotingService } from './voting.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Integração de verdade contra o Postgres do ambiente de desenvolvimento —
 * sem mock de Prisma, mesmo padrão do resto do projeto. Cria/limpa os
 * próprios dados de teste. Cada `it` usa seu próprio tópico (via helper
 * `createOpenTopic`) pra não esbarrar na regra de "só 1 tópico aberto por
 * vez" entre testes.
 */
describe('VotingService (integração)', () => {
  let service: VotingService;
  let prisma: PrismaService;

  let charActiveId: string;
  let charActiveCode: string;
  let charAltId: string;
  let charAltCode: string;
  let charLeftId: string;
  let charLeftCode: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [VotingService, PrismaService],
    }).compile();
    service = moduleRef.get(VotingService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();

    const active = await prisma.character.create({
      data: {
        gameName: 'IntegTestVoting_Ativo',
        status: 'PRINCIPAL',
        membershipStatus: 'ACTIVE',
        level: 50,
        profileAccessCode: 'VOTETEST01',
      },
    });
    charActiveId = active.id;
    charActiveCode = active.profileAccessCode!;

    const alt = await prisma.character.create({
      data: {
        gameName: 'IntegTestVoting_Alt',
        status: 'ALT',
        membershipStatus: 'ACTIVE',
        profileAccessCode: 'VOTETEST02',
      },
    });
    charAltId = alt.id;
    charAltCode = alt.profileAccessCode!;

    const left = await prisma.character.create({
      data: {
        gameName: 'IntegTestVoting_Saiu',
        status: 'PRINCIPAL',
        membershipStatus: 'LEFT',
        level: 40,
        profileAccessCode: 'VOTETEST03',
      },
    });
    charLeftId = left.id;
    charLeftCode = left.profileAccessCode!;
  });

  afterAll(async () => {
    const charIds = [charActiveId, charAltId, charLeftId];
    await prisma.voteSelection.deleteMany({ where: { vote: { characterId: { in: charIds } } } });
    await prisma.vote.deleteMany({ where: { characterId: { in: charIds } } });
    await prisma.votingOption.deleteMany({ where: { topic: { title: { startsWith: 'IntegTestVoting_' } } } });
    await prisma.votingTopic.deleteMany({ where: { title: { startsWith: 'IntegTestVoting_' } } });
    await prisma.character.deleteMany({ where: { id: { in: charIds } } });
    await prisma.$disconnect();
  });

  async function createOpenTopic(title: string, selectionType: 'SINGLE' | 'MULTIPLE' = 'SINGLE') {
    const topic = await service.createDraft(
      { title, description: 'teste', selectionType, options: ['Opção A', 'Opção B', 'Opção C'] },
      'integtest-gm',
    );
    await service.publish(topic.id);
    const full = await prisma.votingTopic.findUniqueOrThrow({ where: { id: topic.id }, include: { options: true } });
    return full;
  }

  it('createDraft cria tópico em DRAFT com as opções', async () => {
    const topic = await service.createDraft(
      { title: 'IntegTestVoting_Draft', description: 'teste', selectionType: 'SINGLE', options: ['A', 'B'] },
      'integtest-gm',
    );
    expect(topic.status).toBe('DRAFT');
    const options = await prisma.votingOption.findMany({ where: { topicId: topic.id } });
    expect(options).toHaveLength(2);
    await prisma.votingOption.deleteMany({ where: { topicId: topic.id } });
    await prisma.votingTopic.delete({ where: { id: topic.id } });
  });

  it('publish rejeita quando já existe outro tópico aberto', async () => {
    const first = await createOpenTopic('IntegTestVoting_Primeiro');
    const second = await service.createDraft(
      { title: 'IntegTestVoting_Segundo', description: 'teste', selectionType: 'SINGLE', options: ['A', 'B'] },
      'integtest-gm',
    );
    await expect(service.publish(second.id)).rejects.toThrow(/já existe uma votação aberta/i);

    await service.closeManually(first.id, 'fim do teste');
  });

  it('vote rejeita código inválido', async () => {
    const topic = await createOpenTopic('IntegTestVoting_CodigoInvalido');
    await expect(
      service.vote(topic.id, 'CODIGO-INEXISTENTE', [topic.options[0].id]),
    ).rejects.toThrow(/código inválido/i);
    await service.closeManually(topic.id, 'fim do teste');
  });

  it('vote rejeita personagem Alt (sem código de perfil de Principal)', async () => {
    const topic = await createOpenTopic('IntegTestVoting_RejeitaAlt');
    await expect(service.vote(topic.id, charAltCode, [topic.options[0].id])).rejects.toThrow();
    await service.closeManually(topic.id, 'fim do teste');
  });

  it('vote rejeita personagem que não está mais ativo na guild', async () => {
    const topic = await createOpenTopic('IntegTestVoting_RejeitaSaiu');
    await expect(service.vote(topic.id, charLeftCode, [topic.options[0].id])).rejects.toThrow(/ativo/i);
    await service.closeManually(topic.id, 'fim do teste');
  });

  it('vote SINGLE rejeita 0 ou 2+ opções selecionadas', async () => {
    const topic = await createOpenTopic('IntegTestVoting_SingleValida');
    await expect(service.vote(topic.id, charActiveCode, [])).rejects.toThrow(/exatamente 1/i);
    await expect(
      service.vote(topic.id, charActiveCode, [topic.options[0].id, topic.options[1].id]),
    ).rejects.toThrow(/exatamente 1/i);
    await service.closeManually(topic.id, 'fim do teste');
  });

  it('vote MULTIPLE aceita várias opções, rejeita 0', async () => {
    const topic = await createOpenTopic('IntegTestVoting_MultiplaValida', 'MULTIPLE');
    await expect(service.vote(topic.id, charActiveCode, [])).rejects.toThrow(/ao menos 1/i);
    await service.vote(topic.id, charActiveCode, [topic.options[0].id, topic.options[1].id]);
    const vote = await prisma.vote.findUniqueOrThrow({
      where: { topicId_characterId: { topicId: topic.id, characterId: charActiveId } },
      include: { selections: true },
    });
    expect(vote.selections).toHaveLength(2);
    await service.closeManually(topic.id, 'fim do teste');
  });

  it('vote rejeita opção que não pertence ao tópico', async () => {
    const topicA = await createOpenTopic('IntegTestVoting_OpcaoErradaA');
    const otherTopic = await service.createDraft(
      { title: 'IntegTestVoting_OpcaoErradaB', description: 'teste', selectionType: 'SINGLE', options: ['X', 'Y'] },
      'integtest-gm',
    );
    const otherOption = await prisma.votingOption.findFirstOrThrow({ where: { topicId: otherTopic.id } });

    await expect(service.vote(topicA.id, charActiveCode, [otherOption.id])).rejects.toThrow();

    await service.closeManually(topicA.id, 'fim do teste');
    await prisma.votingOption.deleteMany({ where: { topicId: otherTopic.id } });
    await prisma.votingTopic.delete({ where: { id: otherTopic.id } });
  });

  it('vote permite trocar de voto enquanto o tópico está aberto', async () => {
    const topic = await createOpenTopic('IntegTestVoting_TrocaVoto');
    await service.vote(topic.id, charActiveCode, [topic.options[0].id]);
    await service.vote(topic.id, charActiveCode, [topic.options[1].id]);

    const votes = await prisma.vote.findMany({ where: { topicId: topic.id, characterId: charActiveId } });
    expect(votes).toHaveLength(1);
    const selections = await prisma.voteSelection.findMany({ where: { voteId: votes[0].id } });
    expect(selections).toHaveLength(1);
    expect(selections[0].optionId).toBe(topic.options[1].id);

    await service.closeManually(topic.id, 'fim do teste');
  });

  it('getResults rejeita antes de votar, aceita depois, com o tópico ainda aberto', async () => {
    const topic = await createOpenTopic('IntegTestVoting_ResultadoGated');
    await expect(service.getResults(topic.id, charActiveCode)).rejects.toThrow(/vote primeiro/i);

    await service.vote(topic.id, charActiveCode, [topic.options[0].id]);
    const results = await service.getResults(topic.id, charActiveCode);
    expect(results.voters.some((v: any) => v.characterId === charActiveId)).toBe(true);

    await service.closeManually(topic.id, 'fim do teste');
  });

  it('getResults fica público (sem código) depois que o tópico fecha', async () => {
    const topic = await createOpenTopic('IntegTestVoting_ResultadoPublico');
    await service.vote(topic.id, charActiveCode, [topic.options[0].id]);
    await service.closeManually(topic.id, 'motivo de teste');

    const results = await service.getResults(topic.id);
    expect(results.voters.length).toBeGreaterThan(0);
  });

  it('resultado mostra o nível ATUAL do personagem, não uma foto de quando votou', async () => {
    const topic = await createOpenTopic('IntegTestVoting_NivelAoVivo');
    await service.vote(topic.id, charActiveCode, [topic.options[0].id]);

    await prisma.character.update({ where: { id: charActiveId }, data: { level: 77 } });

    const results = await service.getResults(topic.id, charActiveCode);
    const voter = results.voters.find((v: any) => v.characterId === charActiveId);
    expect(voter.level).toBe(77);

    await prisma.character.update({ where: { id: charActiveId }, data: { level: 50 } });
    await service.closeManually(topic.id, 'fim do teste');
  });

  it('mensagem ocultada some do resultado público mas continua visível pro GM', async () => {
    const topic = await createOpenTopic('IntegTestVoting_MensagemOculta');
    await service.vote(topic.id, charActiveCode, [topic.options[0].id], 'mensagem de teste');

    let results = await service.getResults(topic.id, charActiveCode);
    expect(results.voters.find((v: any) => v.characterId === charActiveId).message).toBe('mensagem de teste');

    await service.hideMessage(topic.id, charActiveId);

    results = await service.getResults(topic.id, charActiveCode);
    expect(results.voters.find((v: any) => v.characterId === charActiveId).message).toBeNull();

    const staffViewGm = await service.getForStaff(topic.id, 'GM');
    expect(staffViewGm.votes.find((v: any) => v.characterId === charActiveId).message).toBe('mensagem de teste');

    const staffViewCouncil = await service.getForStaff(topic.id, 'COUNCIL');
    expect(staffViewCouncil.votes.find((v: any) => v.characterId === charActiveId).message).toBeNull();

    await service.closeManually(topic.id, 'fim do teste');
  });

  it('closeManually encerra e bloqueia novos votos', async () => {
    const topic = await createOpenTopic('IntegTestVoting_Encerramento');
    await service.closeManually(topic.id, 'motivo de teste');

    const closed = await prisma.votingTopic.findUniqueOrThrow({ where: { id: topic.id } });
    expect(closed.status).toBe('CLOSED');
    expect(closed.closeReason).toBe('motivo de teste');

    await expect(service.vote(topic.id, charActiveCode, [topic.options[0].id])).rejects.toThrow();
  });

  it('resolveExpiredTopics encerra sozinho um tópico com scheduledEndAt no passado', async () => {
    const draft = await service.createDraft(
      {
        title: 'IntegTestVoting_AutoEncerra',
        description: 'teste',
        selectionType: 'SINGLE',
        options: ['A', 'B'],
        scheduledEndAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      },
      'integtest-gm',
    );
    await service.publish(draft.id);
    // Força o prazo pro passado direto no banco (sem precisar esperar de verdade).
    await prisma.votingTopic.update({ where: { id: draft.id }, data: { scheduledEndAt: new Date(Date.now() - 1000) } });

    await service.resolveExpiredTopics();

    const closed = await prisma.votingTopic.findUniqueOrThrow({ where: { id: draft.id } });
    expect(closed.status).toBe('CLOSED');
  });
});
