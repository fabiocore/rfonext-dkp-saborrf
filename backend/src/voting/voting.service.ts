import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

type SelectionType = 'SINGLE' | 'MULTIPLE';
type StaffRole = 'GM' | 'VICE_GM' | 'COUNCIL';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VotingService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------
  // Gestão (GM/Vice-GM) — Conselho não cria nem publica votação.
  // ---------------------------------------------------------------------

  async createDraft(
    data: { title: string; description: string; selectionType: SelectionType; options: string[]; scheduledEndAt?: string },
    createdById: string,
  ) {
    if (!data.title?.trim()) throw new BadRequestException('Título é obrigatório.');
    if (!data.description?.trim()) throw new BadRequestException('Descrição é obrigatória.');
    const cleanOptions = (data.options ?? []).map((o) => o.trim()).filter(Boolean);
    if (cleanOptions.length < 2) throw new BadRequestException('Adicione ao menos 2 opções.');

    let scheduledEndAt: Date | null = null;
    if (data.scheduledEndAt) {
      scheduledEndAt = new Date(data.scheduledEndAt);
      if (Number.isNaN(scheduledEndAt.getTime())) throw new BadRequestException('Data/hora de término inválida.');
      if (scheduledEndAt <= new Date()) throw new BadRequestException('A data/hora de término precisa ser no futuro.');
    }

    return this.prisma.votingTopic.create({
      data: {
        title: data.title.trim(),
        description: data.description.trim(),
        selectionType: data.selectionType,
        scheduledEndAt,
        createdById,
        options: { create: cleanOptions.map((label, i) => ({ label, order: i })) },
      },
      include: { options: true },
    });
  }

  listForStaff() {
    return this.prisma.votingTopic.findMany({
      orderBy: { createdAt: 'desc' },
      include: { options: true, _count: { select: { votes: true } } },
    });
  }

  async getForStaff(topicId: string, viewerRole: StaffRole) {
    const topic = await this.prisma.votingTopic.findUnique({
      where: { id: topicId },
      include: {
        options: { orderBy: { order: 'asc' } },
        votes: {
          include: { character: true, selections: { include: { option: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!topic) throw new NotFoundException('Votação não encontrada.');

    // Mensagem oculta só continua visível pra GM/Vice-GM — nem o Conselho vê,
    // mesmo tendo acesso de leitura ao resto da tela (decisão explícita do GM).
    const canSeeHidden = viewerRole === 'GM' || viewerRole === 'VICE_GM';

    return {
      ...topic,
      votes: topic.votes.map((v) => ({
        characterId: v.characterId,
        gameName: v.character.gameName,
        level: v.character.level,
        optionLabels: v.selections.map((s) => s.option.label),
        message: !v.messageHidden || canSeeHidden ? v.message : null,
        messageHidden: v.messageHidden,
      })),
    };
  }

  /**
   * Só 1 tópico OPEN por vez (checado na aplicação, com lock consultivo pra
   * evitar corrida entre dois publish() concorrentes) — decisão explícita do
   * GM, diferente do leilão que permite vários simultâneos.
   */
  async publish(topicId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('voting-topic-publish')::bigint)`;

      const topic = await tx.votingTopic.findUnique({ where: { id: topicId }, include: { options: true } });
      if (!topic) throw new NotFoundException('Votação não encontrada.');
      if (topic.status !== 'DRAFT') throw new BadRequestException('Esta votação já foi publicada ou encerrada.');
      if (topic.options.length < 2) throw new BadRequestException('Adicione ao menos 2 opções antes de publicar.');

      const otherOpen = await tx.votingTopic.findFirst({ where: { status: 'OPEN', id: { not: topicId } } });
      if (otherOpen) {
        throw new BadRequestException('Já existe uma votação aberta — encerre ela antes de publicar uma nova.');
      }

      return tx.votingTopic.update({ where: { id: topicId }, data: { status: 'OPEN', publishedAt: new Date() } });
    });
  }

  async closeManually(topicId: string, reason: string) {
    if (!reason?.trim()) throw new BadRequestException('Motivo é obrigatório pra encerrar a votação.');
    const topic = await this.prisma.votingTopic.findUnique({ where: { id: topicId } });
    if (!topic) throw new NotFoundException('Votação não encontrada.');
    if (topic.status !== 'OPEN') throw new BadRequestException('Só é possível encerrar uma votação aberta.');
    return this.prisma.votingTopic.update({
      where: { id: topicId },
      data: { status: 'CLOSED', closedAt: new Date(), closeReason: reason.trim() },
    });
  }

  async deleteDraft(topicId: string) {
    const topic = await this.prisma.votingTopic.findUnique({ where: { id: topicId } });
    if (!topic) throw new NotFoundException('Votação não encontrada.');
    if (topic.status !== 'DRAFT') throw new BadRequestException('Só é possível apagar uma votação ainda não publicada.');
    await this.prisma.$transaction(async (tx) => {
      await tx.votingOption.deleteMany({ where: { topicId } });
      await tx.votingTopic.delete({ where: { id: topicId } });
    });
  }

  async hideMessage(topicId: string, characterId: string) {
    await this.assertVoteExists(topicId, characterId);
    await this.prisma.vote.update({ where: { topicId_characterId: { topicId, characterId } }, data: { messageHidden: true } });
  }

  async unhideMessage(topicId: string, characterId: string) {
    await this.assertVoteExists(topicId, characterId);
    await this.prisma.vote.update({
      where: { topicId_characterId: { topicId, characterId } },
      data: { messageHidden: false },
    });
  }

  private async assertVoteExists(topicId: string, characterId: string) {
    const vote = await this.prisma.vote.findUnique({ where: { topicId_characterId: { topicId, characterId } } });
    if (!vote) throw new NotFoundException('Voto não encontrado.');
  }

  // ---------------------------------------------------------------------
  // Público (sem login) — código de PERFIL, o mesmo do /perfil.
  // ---------------------------------------------------------------------

  getCurrentOpenTopic() {
    return this.prisma.votingTopic.findFirst({ where: { status: 'OPEN' }, select: { id: true, title: true } });
  }

  async getTopicForVoting(topicId: string) {
    const topic = await this.prisma.votingTopic.findUnique({
      where: { id: topicId },
      include: { options: { orderBy: { order: 'asc' } } },
    });
    if (!topic || topic.status === 'DRAFT') throw new NotFoundException('Votação não encontrada.');
    return {
      id: topic.id,
      title: topic.title,
      description: topic.description,
      selectionType: topic.selectionType,
      status: topic.status,
      closeReason: topic.closeReason,
      options: topic.options.map((o) => ({ id: o.id, label: o.label })),
    };
  }

  private async resolveVoter(code: string) {
    const character = await this.prisma.character.findUnique({ where: { profileAccessCode: code } });
    if (!character) throw new NotFoundException('Código inválido.');
    if (character.status !== 'PRINCIPAL') {
      throw new ForbiddenException('Só personagens Principais podem votar.');
    }
    if (character.membershipStatus !== 'ACTIVE') {
      throw new ForbiddenException('Você não está mais ativo na guild e não pode votar.');
    }
    return character;
  }

  /** Trocar de voto é permitido enquanto o tópico estiver OPEN (decisão explícita do GM). */
  async vote(topicId: string, code: string, optionIds: string[], message?: string) {
    const character = await this.resolveVoter(code);

    const topic = await this.prisma.votingTopic.findUnique({ where: { id: topicId }, include: { options: true } });
    if (!topic) throw new NotFoundException('Votação não encontrada.');
    if (topic.status !== 'OPEN') throw new BadRequestException('Esta votação não está mais aberta.');

    const validOptionIds = new Set(topic.options.map((o) => o.id));
    const uniqueOptionIds = Array.from(new Set(optionIds ?? []));
    if (uniqueOptionIds.some((id) => !validOptionIds.has(id))) {
      throw new BadRequestException('Opção inválida pra essa votação.');
    }
    if (topic.selectionType === 'SINGLE' && uniqueOptionIds.length !== 1) {
      throw new BadRequestException('Escolha exatamente 1 opção.');
    }
    if (topic.selectionType === 'MULTIPLE' && uniqueOptionIds.length < 1) {
      throw new BadRequestException('Escolha ao menos 1 opção.');
    }

    const trimmedMessage = message?.trim() || null;

    await this.prisma.$transaction(async (tx) => {
      const vote = await tx.vote.upsert({
        where: { topicId_characterId: { topicId, characterId: character.id } },
        update: { message: trimmedMessage, updatedAt: new Date() },
        create: { topicId, characterId: character.id, message: trimmedMessage },
      });
      // Substitui a seleção inteira — mais simples e seguro que tentar
      // calcular diff, e o volume por voto é sempre pequeno (poucas opções).
      await tx.voteSelection.deleteMany({ where: { voteId: vote.id } });
      await tx.voteSelection.createMany({ data: uniqueOptionIds.map((optionId) => ({ voteId: vote.id, optionId })) });
    });
  }

  /**
   * Enquanto o tópico está OPEN, só quem já votou (código válido + voto
   * registrado) consegue ver o resultado. Depois de CLOSED, fica público
   * pra todo mundo, sem código — mesma régua de "leilão encerrado é
   * público até pra quem não participou".
   */
  async getResults(topicId: string, code?: string) {
    const topic = await this.prisma.votingTopic.findUnique({
      where: { id: topicId },
      include: { options: { orderBy: { order: 'asc' } } },
    });
    if (!topic || topic.status === 'DRAFT') throw new NotFoundException('Votação não encontrada.');

    // Quando um código válido é informado, guardamos o próprio voto (se
    // houver) pra devolver como `myVote` — usado pra pré-preencher a cédula
    // na hora de trocar o voto, sem precisar expor "quem é quem" pro resto
    // da lista pública.
    let myVote: { optionIds: string[]; message: string | null } | null = null;

    if (topic.status !== 'CLOSED') {
      if (!code) throw new ForbiddenException('Vote primeiro pra ver o resultado.');
      const character = await this.prisma.character.findUnique({ where: { profileAccessCode: code } });
      if (!character) throw new NotFoundException('Código inválido.');
      const own = await this.prisma.vote.findUnique({
        where: { topicId_characterId: { topicId, characterId: character.id } },
        include: { selections: true },
      });
      if (!own) throw new ForbiddenException('Vote primeiro pra ver o resultado.');
      myVote = { optionIds: own.selections.map((s) => s.optionId), message: own.message };
    } else if (code) {
      const character = await this.prisma.character.findUnique({ where: { profileAccessCode: code } });
      if (character) {
        const own = await this.prisma.vote.findUnique({
          where: { topicId_characterId: { topicId, characterId: character.id } },
          include: { selections: true },
        });
        if (own) myVote = { optionIds: own.selections.map((s) => s.optionId), message: own.message };
      }
    }

    const votes = await this.prisma.vote.findMany({
      where: { topicId },
      include: { character: true, selections: { include: { option: true } } },
      orderBy: { createdAt: 'asc' },
    });

    const tally = topic.options.map((o) => ({
      optionId: o.id,
      label: o.label,
      count: votes.filter((v) => v.selections.some((s) => s.optionId === o.id)).length,
    }));

    const voters = votes.map((v) => ({
      characterId: v.characterId,
      gameName: v.character.gameName,
      // Nível ao vivo (do personagem agora), não uma foto de quando votou —
      // mesmo padrão do resto do sistema (elegibilidade de leilão etc.).
      level: v.character.level,
      optionLabels: v.selections.map((s) => s.option.label),
      message: v.messageHidden ? null : v.message,
    }));

    return {
      topic: {
        id: topic.id,
        title: topic.title,
        description: topic.description,
        selectionType: topic.selectionType,
        status: topic.status,
        closeReason: topic.closeReason,
      },
      tally,
      voters,
      myVote,
    };
  }

  // ---------------------------------------------------------------------
  // Resolução automática (cron)
  // ---------------------------------------------------------------------

  async resolveExpiredTopics() {
    const expired = await this.prisma.votingTopic.findMany({
      where: { status: 'OPEN', scheduledEndAt: { lte: new Date() } },
    });
    for (const topic of expired) {
      await this.prisma.votingTopic.update({
        where: { id: topic.id },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
          closeReason: 'Encerrada automaticamente (prazo definido na criação).',
        },
      });
    }
    return { closed: expired.length };
  }
}
