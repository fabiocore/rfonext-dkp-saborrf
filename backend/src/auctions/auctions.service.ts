import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { rollTiebreakDice } from './dice-tiebreak.util';

type ResolvableItem = {
  id: string;
  bids: { id: string; amount: number; characterId: string; character: { gameName: string } }[];
  withdrawals: { characterId: string }[];
};

const EDITABLE_STATUSES = ['DRAFT', 'PENDING_APPROVAL'] as const;

@Injectable()
export class AuctionsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------
  // Gestão (staff)
  // ---------------------------------------------------------------------

  createDraft(title: string, createdById: string) {
    if (!title?.trim()) throw new BadRequestException('Título é obrigatório.');
    return this.prisma.auction.create({ data: { title, createdById, status: 'DRAFT' } });
  }

  listForStaff() {
    return this.prisma.auction.findMany({
      orderBy: { createdAt: 'desc' },
      include: { items: true, participants: true, approvals: true },
    });
  }

  async getForStaff(id: string) {
    const auction = await this.prisma.auction.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            protection: true,
            winningBid: { include: { character: true } },
            withdrawals: { include: { character: true } },
          },
        },
        participants: { include: { character: true } },
        approvals: true,
      },
    });
    if (!auction) throw new NotFoundException('Leilão não encontrado.');
    return auction;
  }

  private async assertEditable(auctionId: string) {
    const auction = await this.prisma.auction.findUnique({ where: { id: auctionId } });
    if (!auction) throw new NotFoundException('Leilão não encontrado.');
    if (!EDITABLE_STATUSES.includes(auction.status as (typeof EDITABLE_STATUSES)[number])) {
      throw new BadRequestException('Este leilão já foi publicado e não pode mais ser editado.');
    }
    return auction;
  }

  /**
   * Proteção desativada não pode ser anexada a item novo nem posta num item
   * existente — o dropdown do admin já filtra isso (AuctionBuilderPage),
   * mas só no cliente, então não é uma garantia de verdade (cache
   * desatualizada, outra aba, chamada direta na API). `null`/`undefined`
   * passa direto (sem proteção, ou "não mexer no campo" no updateItem).
   */
  private async assertProtectionActive(protectionId: string | null | undefined) {
    if (!protectionId) return;
    const protection = await this.prisma.protection.findUnique({
      where: { id: protectionId },
      select: { isActive: true },
    });
    if (!protection) throw new NotFoundException('Proteção não encontrada.');
    if (!protection.isActive) {
      throw new BadRequestException('Esta proteção está desativada e não pode ser usada em itens novos.');
    }
  }

  async addItem(
    auctionId: string,
    data: { name: string; description?: string; protectionId?: string | null; imageUrl?: string | null },
  ) {
    await this.assertEditable(auctionId);
    if (!data.name?.trim()) throw new BadRequestException('Nome do item é obrigatório.');
    await this.assertProtectionActive(data.protectionId);
    return this.prisma.auctionItem.create({
      data: {
        auctionId,
        name: data.name,
        description: data.description,
        protectionId: data.protectionId || null,
        imageUrl: data.imageUrl || null,
      },
    });
  }

  async updateItem(
    auctionId: string,
    itemId: string,
    data: { name?: string; description?: string; protectionId?: string | null; imageUrl?: string | null },
  ) {
    await this.assertEditable(auctionId);
    await this.assertProtectionActive(data.protectionId);
    return this.prisma.auctionItem.update({ where: { id: itemId }, data });
  }

  async removeItem(auctionId: string, itemId: string) {
    await this.assertEditable(auctionId);
    await this.prisma.auctionItem.delete({ where: { id: itemId } });
  }

  /**
   * Apaga um leilão inteiro — só permitido em DRAFT/PENDING_APPROVAL (nunca
   * publicado, então nunca teve lance/código/queima real). Um leilão já
   * OPEN ou CLOSED não pode ser apagado, só encerrado com motivo
   * (`closeAuction`), pra preservar o histórico público.
   */
  async deleteDraft(auctionId: string) {
    await this.assertEditable(auctionId);

    await this.prisma.$transaction(async (tx) => {
      const itemIds = (await tx.auctionItem.findMany({ where: { auctionId }, select: { id: true } })).map(
        (i) => i.id,
      );
      if (itemIds.length > 0) {
        await tx.bid.deleteMany({ where: { auctionItemId: { in: itemIds } } });
        await tx.auctionItemWithdrawal.deleteMany({ where: { auctionItemId: { in: itemIds } } });
        await tx.auctionItem.deleteMany({ where: { id: { in: itemIds } } });
      }
      await tx.auctionParticipant.deleteMany({ where: { auctionId } });
      await tx.auctionApproval.deleteMany({ where: { auctionId } });
      await tx.auction.delete({ where: { id: auctionId } });
    });
  }

  /**
   * GM-only: apaga um item específico em QUALQUER status do leilão
   * (rascunho, aberto ou encerrado) — diferente de `removeItem`, que só
   * funciona em DRAFT/PENDING_APPROVAL e sem motivo. Se o item já tinha
   * sido vencido (queima real já registrada no ledger), a queima **nunca**
   * é apagada/editada — ledger é append-only (PREMISSAS.md seção 4) — em
   * vez disso cria uma transação de reversão (`AUCTION_WIN_REVERSAL`)
   * creditando o vencedor de volta, antes de apagar o item. Assim o
   * histórico financeiro fica completo (dá pra ver a queima original E a
   * reversão) mesmo depois do item deixar de existir.
   */
  async forceDeleteItem(auctionId: string, itemId: string, reason: string) {
    if (!reason?.trim()) throw new BadRequestException('Motivo é obrigatório pra apagar um item.');
    const trimmedReason = reason.trim();

    const item = await this.prisma.auctionItem.findUnique({
      where: { id: itemId },
      include: { winningBid: true, auction: { select: { title: true } } },
    });
    if (!item || item.auctionId !== auctionId) throw new NotFoundException('Item não encontrado neste leilão.');

    return this.prisma.$transaction(async (tx) => {
      if (item.resolutionStatus === 'WON' && item.winningBid) {
        await tx.ledgerTransaction.create({
          data: {
            characterId: item.winningBid.characterId,
            amount: item.winningBid.amount,
            type: 'AUCTION_WIN_REVERSAL',
            reasonText: `Item "${item.name}" (leilão "${item.auction.title}") apagado pelo GM — motivo: ${trimmedReason}`,
          },
        });
      }
      await tx.bid.deleteMany({ where: { auctionItemId: itemId } });
      await tx.auctionItemWithdrawal.deleteMany({ where: { auctionItemId: itemId } });
      await tx.auctionItem.delete({ where: { id: itemId } });
    });
  }

  /**
   * GM-only: apaga o leilão inteiro em QUALQUER status — mesma lógica de
   * reversão do `forceDeleteItem`, aplicada a cada item vencido do leilão,
   * tudo numa única transação atômica (ou reverte tudo, ou nada muda).
   */
  async forceDeleteAuction(auctionId: string, reason: string) {
    if (!reason?.trim()) throw new BadRequestException('Motivo é obrigatório pra apagar um leilão.');
    const trimmedReason = reason.trim();

    const auction = await this.prisma.auction.findUnique({
      where: { id: auctionId },
      include: { items: { include: { winningBid: true } } },
    });
    if (!auction) throw new NotFoundException('Leilão não encontrado.');

    await this.prisma.$transaction(async (tx) => {
      for (const item of auction.items) {
        if (item.resolutionStatus === 'WON' && item.winningBid) {
          await tx.ledgerTransaction.create({
            data: {
              characterId: item.winningBid.characterId,
              amount: item.winningBid.amount,
              type: 'AUCTION_WIN_REVERSAL',
              reasonText: `Item "${item.name}" (leilão "${auction.title}") apagado pelo GM — motivo: ${trimmedReason}`,
            },
          });
        }
      }
      const itemIds = auction.items.map((i) => i.id);
      if (itemIds.length > 0) {
        await tx.bid.deleteMany({ where: { auctionItemId: { in: itemIds } } });
        await tx.auctionItemWithdrawal.deleteMany({ where: { auctionItemId: { in: itemIds } } });
        await tx.auctionItem.deleteMany({ where: { id: { in: itemIds } } });
      }
      await tx.auctionParticipant.deleteMany({ where: { auctionId } });
      await tx.auctionApproval.deleteMany({ where: { auctionId } });
      await tx.auction.delete({ where: { id: auctionId } });
    });
  }

  /**
   * Data/hora exata em que o leilão termina — definida pelo GM/conselho
   * antes de publicar, em vez de uma duração fixa de 24h contada a partir
   * da publicação.
   */
  async setSchedule(auctionId: string, scheduledEndAt: string) {
    await this.assertEditable(auctionId);
    const date = new Date(scheduledEndAt);
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Data/hora de término inválida.');
    if (date <= new Date()) throw new BadRequestException('A data/hora de término precisa ser no futuro.');
    return this.prisma.auction.update({ where: { id: auctionId }, data: { scheduledEndAt: date } });
  }

  /** Marca quais Principais "Ativo na Guild" participaram do evento no jogo. */
  async setParticipants(auctionId: string, characterIds: string[]) {
    await this.assertEditable(auctionId);

    const validCharacters = await this.prisma.character.findMany({
      where: { id: { in: characterIds }, status: 'PRINCIPAL', membershipStatus: 'ACTIVE' },
      select: { id: true },
    });
    const validIds = new Set(validCharacters.map((c) => c.id));

    await this.prisma.$transaction(async (tx) => {
      await tx.auctionParticipant.deleteMany({ where: { auctionId } });
      if (validIds.size > 0) {
        await tx.auctionParticipant.createMany({
          data: Array.from(validIds).map((characterId) => ({ auctionId, characterId })),
        });
      }
    });

    return this.getForStaff(auctionId);
  }

  /**
   * GM publica direto; Conselho só registra aprovação — com 2 aprovações de
   * conselheiros distintos o leilão publica sozinho (PREMISSAS.md seção 7).
   */
  async approve(auctionId: string, user: AuthenticatedUser) {
    const auction = await this.prisma.auction.findUnique({ where: { id: auctionId } });
    if (!auction) throw new NotFoundException('Leilão não encontrado.');
    if (auction.status === 'OPEN' || auction.status === 'CLOSED') {
      throw new BadRequestException('Este leilão já foi publicado.');
    }

    const itemCount = await this.prisma.auctionItem.count({ where: { auctionId } });
    if (itemCount === 0) throw new BadRequestException('Adicione ao menos 1 item antes de publicar.');
    const participantCount = await this.prisma.auctionParticipant.count({ where: { auctionId } });
    if (participantCount === 0) throw new BadRequestException('Marque ao menos 1 participante antes de publicar.');
    if (!auction.scheduledEndAt) throw new BadRequestException('Defina a data/hora de término antes de publicar.');
    if (auction.scheduledEndAt <= new Date()) {
      throw new BadRequestException('A data/hora de término precisa ser no futuro — ajuste antes de publicar.');
    }

    if (user.role === 'GM' || user.role === 'VICE_GM') {
      return this.publish(auctionId);
    }

    // Conselho: registra aprovação (idempotente por usuário via unique constraint).
    await this.prisma.auctionApproval.upsert({
      where: { auctionId_userId: { auctionId, userId: user.id } },
      update: {},
      create: { auctionId, userId: user.id },
    });
    if (auction.status === 'DRAFT') {
      await this.prisma.auction.update({ where: { id: auctionId }, data: { status: 'PENDING_APPROVAL' } });
    }

    const approvals = await this.prisma.auctionApproval.count({ where: { auctionId } });
    if (approvals >= 2) {
      return this.publish(auctionId);
    }
    return this.getForStaff(auctionId);
  }

  private async publish(auctionId: string) {
    const auction = await this.prisma.auction.findUniqueOrThrow({ where: { id: auctionId } });

    const now = new Date();
    // A data/hora de término é definida pelo GM/conselho antes de publicar
    // (setSchedule) — approve() já garante que existe e está no futuro.
    const expiresAt = auction.scheduledEndAt!;

    // Não gera código nenhum aqui — desde 2026-08-14, acesso ao leilão é
    // pelo código de leilão FIXO do personagem (Character.auctionAccessCode,
    // consultado no /perfil dele), não por um código novo por leilão. Quem
    // já está marcado como participante (setParticipants) já consegue
    // acessar assim que o leilão publica, sem distribuição manual nenhuma.
    return this.prisma.auction.update({
      where: { id: auctionId },
      data: { status: 'OPEN', publishedAt: now, expiresAt },
    });
  }

  private isEligible(character: { level: number | null }, item: { protectionId: string | null; protection: { minLevel: number } | null }) {
    if (!item.protectionId || !item.protection) return true;
    return (character.level ?? 0) >= item.protection.minLevel;
  }

  // ---------------------------------------------------------------------
  // Público (sem login) — painel de acompanhamento
  // ---------------------------------------------------------------------

  getPublicList() {
    return this.prisma.auction.findMany({
      where: { status: { in: ['OPEN', 'CLOSED'] } },
      orderBy: { publishedAt: 'desc' },
      select: { id: true, title: true, status: true, publishedAt: true, expiresAt: true, items: { select: { id: true } } },
    });
  }

  async getPublicDetail(id: string) {
    const auction = await this.prisma.auction.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            protection: true,
            bids: { include: { character: true }, orderBy: { amount: 'desc' } },
            winningBid: { include: { character: true } },
            withdrawals: { select: { characterId: true } },
          },
        },
      },
    });
    if (!auction || auction.status === 'DRAFT' || auction.status === 'PENDING_APPROVAL') {
      throw new NotFoundException('Leilão não encontrado.');
    }
    return auction;
  }

  // ---------------------------------------------------------------------
  // Jogador via código de acesso
  // ---------------------------------------------------------------------

  /**
   * Código de leilão é FIXO por personagem (Character.auctionAccessCode,
   * desde 2026-08-14) — resolve o personagem primeiro, depois confirma que
   * ele está marcado como participante DESSE leilão específico. Sem isso,
   * o código não libera acesso a leilão nenhum que a pessoa não tenha
   * participado (só ver, que já é público em /leiloes, sem código).
   */
  private async resolveParticipant(code: string, auctionId: string) {
    const character = await this.prisma.character.findUnique({ where: { auctionAccessCode: code } });
    if (!character) throw new NotFoundException('Código inválido.');

    const participant = await this.prisma.auctionParticipant.findUnique({
      where: { auctionId_characterId: { auctionId, characterId: character.id } },
      include: {
        character: true,
        auction: { include: { items: { include: { protection: true, bids: true, withdrawals: true } } } },
      },
    });
    if (!participant) throw new ForbiddenException('Você não participou deste leilão.');
    return participant;
  }

  /** Lista os leilões abertos em que o dono desse código participa — central pessoal em /oferta/:código. */
  async getMyAuctions(code: string) {
    const character = await this.prisma.character.findUnique({ where: { auctionAccessCode: code } });
    if (!character) throw new NotFoundException('Código inválido.');

    const participations = await this.prisma.auctionParticipant.findMany({
      where: { characterId: character.id, auction: { status: 'OPEN' } },
      include: { auction: { include: { items: { select: { id: true } } } } },
    });

    const now = new Date();
    const auctions = participations
      .filter((p) => p.auction.expiresAt && p.auction.expiresAt > now)
      .map((p) => ({
        id: p.auction.id,
        title: p.auction.title,
        expiresAt: p.auction.expiresAt,
        itemCount: p.auction.items.length,
      }))
      .sort((a, b) => (a.expiresAt && b.expiresAt ? a.expiresAt.getTime() - b.expiresAt.getTime() : 0));

    return { character: { id: character.id, gameName: character.gameName }, auctions };
  }

  async getParticipantView(code: string, auctionId: string) {
    const participant = await this.resolveParticipant(code, auctionId);
    const walletBalance = await this.getBalance(participant.characterId);
    const hold = await this.computeHold(participant.characterId, null);
    const guildSettings = await this.prisma.guildSettings.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1, guildName: 'Minha Guild' },
    });

    const items = participant.auction.items.map((item) => {
      const withdrawnCharacterIds = new Set(item.withdrawals.map((w) => w.characterId));
      const activeBids = item.bids.filter((b) => !withdrawnCharacterIds.has(b.characterId));
      const eligible = this.isEligible(participant.character, item);
      const leadingAmount = activeBids.reduce((max, b) => Math.max(max, b.amount), 0);
      const ownAmount = item.bids
        .filter((b) => b.characterId === participant.characterId)
        .reduce((max, b) => Math.max(max, b.amount), 0);
      const winningBid = item.winningBidId ? item.bids.find((b) => b.id === item.winningBidId) : undefined;
      const won = winningBid?.characterId === participant.characterId;
      // Lance mínimo de verdade pra esse item: se ainda não tem lance
      // nenhum, é o mínimo configurado (proteção ou padrão da guild) — sem
      // somar 1 (bug corrigido em 2026-08-09: se a proteção pede mínimo 30,
      // o primeiro lance pode ser exatamente 30). Só quando já existe um
      // líder é que o próximo lance precisa SUPERAR (+1).
      const configuredMin = item.protection ? item.protection.minBid : guildSettings.defaultMinBid;
      const minBid = leadingAmount > 0 ? leadingAmount + 1 : configuredMin;
      return {
        id: item.id,
        name: item.name,
        description: item.description,
        imageUrl: item.imageUrl,
        protection: item.protection,
        eligible,
        leadingAmount,
        minBid,
        ownAmount,
        won,
        bidCount: activeBids.length,
        withdrawn: withdrawnCharacterIds.has(participant.characterId),
        resolutionStatus: item.resolutionStatus,
        cancelReason: item.cancelReason,
      };
    });

    const isActive = participant.auction.status === 'OPEN' && participant.auction.expiresAt! > new Date();

    return {
      character: {
        id: participant.character.id,
        gameName: participant.character.gameName,
        level: participant.character.level,
        // Código de /perfil (diferente do código de leilão que ele já está
        // usando pra ver essa tela) — só pra montar o link "Atualizar meu
        // nível" quando ele não bate o requisito de algum item. Mesma
        // pessoa, mesmo personagem: não é vazamento de credencial de
        // terceiro, é o próprio código dele sendo devolvido a ele.
        profileAccessCode: participant.character.profileAccessCode,
      },
      auction: {
        id: participant.auction.id,
        title: participant.auction.title,
        status: participant.auction.status,
        expiresAt: participant.auction.expiresAt,
      },
      isActive,
      walletBalance,
      availableBalance: walletBalance - hold,
      items,
    };
  }

  async placeBid(code: string, auctionItemId: string, amount: number) {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Valor de lance inválido.');
    }

    const itemRef = await this.prisma.auctionItem.findUnique({
      where: { id: auctionItemId },
      select: { auctionId: true },
    });
    if (!itemRef) throw new NotFoundException('Item não encontrado.');

    const participant = await this.resolveParticipant(code, itemRef.auctionId);
    const auction = participant.auction;

    if (auction.status !== 'OPEN' || !auction.expiresAt || auction.expiresAt <= new Date()) {
      throw new BadRequestException('Este leilão não está mais aberto para lances.');
    }

    const item = auction.items.find((i) => i.id === auctionItemId);
    if (!item) throw new NotFoundException('Item não encontrado neste leilão.');
    if (!this.isEligible(participant.character, item)) {
      throw new ForbiddenException('Você não atinge o nível mínimo exigido para este item.');
    }

    const guildSettings = await this.prisma.guildSettings.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1, guildName: 'Minha Guild' },
    });
    const configuredMin = item.protection ? item.protection.minBid : guildSettings.defaultMinBid;

    return this.prisma.$transaction(async (tx) => {
      // Trava por personagem: impede duas ofertas concorrentes do mesmo
      // jogador (em itens/leilões diferentes) de aprovarem saldo que na
      // verdade só existe uma vez.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${participant.characterId})::bigint)`;

      // Checagem fresca (dentro do lock): o item pode ter sido resolvido
      // (vitória automática por desistência de todo mundo, cancelado pelo
      // GM, ou expirado) entre o carregamento inicial e agora.
      const freshItem = await tx.auctionItem.findUnique({
        where: { id: auctionItemId },
        select: { resolutionStatus: true },
      });
      if (!freshItem || freshItem.resolutionStatus !== 'PENDING') {
        throw new BadRequestException('Este item já foi resolvido e não aceita mais lances.');
      }
      // Lance líder ignora quem já desistiu — não faz sentido exigir superar
      // o lance de um "fantasma" que não está mais concorrendo pelo item.
      // Quem já desistiu PODE dar um novo lance (volta a participar) — a
      // própria marca de desistência é removida logo abaixo, no mesmo passo
      // do novo lance.
      const itemWithdrawals = await tx.auctionItemWithdrawal.findMany({
        where: { auctionItemId },
        select: { characterId: true },
      });
      const withdrawnIds = itemWithdrawals.map((w) => w.characterId);

      const leadingAgg = await tx.bid.aggregate({
        where: { auctionItemId, characterId: { notIn: withdrawnIds } },
        _max: { amount: true },
      });
      const leadingAmount = leadingAgg._max.amount ?? 0;

      const ownAgg = await tx.bid.aggregate({
        where: { auctionItemId, characterId: participant.characterId },
        _max: { amount: true },
      });
      const ownAmount = ownAgg._max.amount ?? 0;

      const effectiveMin = Math.max(configuredMin, leadingAmount);
      if (amount < effectiveMin) {
        throw new BadRequestException(`O lance mínimo agora é ${effectiveMin}.`);
      }
      if (amount <= ownAmount) {
        throw new BadRequestException('Seu novo lance precisa ser maior que o seu lance anterior neste item.');
      }

      const walletBalance = await this.getBalanceTx(tx, participant.characterId);
      const hold = await this.computeHoldTx(tx, participant.characterId, auctionItemId);
      const available = walletBalance - hold;
      if (amount > available) {
        throw new BadRequestException(`Saldo disponível insuficiente. Você tem ${available} disponível agora.`);
      }

      if (withdrawnIds.includes(participant.characterId)) {
        await tx.auctionItemWithdrawal.deleteMany({
          where: { auctionItemId, characterId: participant.characterId },
        });
      }

      return tx.bid.create({
        data: { auctionItemId, characterId: participant.characterId, amount },
      });
    });
  }

  /**
   * "Igualar Lance": ação separada do lance manual, pensada especificamente
   * pra quem NÃO tem saldo pra superar o líder (+1) mas tem exatamente o
   * suficiente pra igualar. Por decisão explícita do GM, só aceita quando
   * for uma aposta all-in de verdade — o valor do lance líder precisa ser
   * EXATAMENTE igual ao saldo disponível do personagem nesse momento, nem
   * menos (saldo insuficiente) nem mais (aí é pra usar o campo de lance
   * normal e superar, não igualar). Cada rejeição devolve o motivo exato,
   * pra nunca gerar dúvida sobre por que o botão não funcionou. Reaproveita
   * o mesmo lock por personagem do placeBid, mas é um método separado (não
   * uma variação de placeBid) porque a regra de valor é fundamentalmente
   * diferente: aqui o valor não vem do jogador, é sempre o lance líder.
   */
  async matchLeadingBid(code: string, auctionItemId: string) {
    const itemRef = await this.prisma.auctionItem.findUnique({
      where: { id: auctionItemId },
      select: { auctionId: true },
    });
    if (!itemRef) throw new NotFoundException('Item não encontrado.');

    const participant = await this.resolveParticipant(code, itemRef.auctionId);
    const auction = participant.auction;

    if (auction.status !== 'OPEN' || !auction.expiresAt || auction.expiresAt <= new Date()) {
      throw new BadRequestException('Este leilão não está mais aberto para lances.');
    }

    const item = auction.items.find((i) => i.id === auctionItemId);
    if (!item) throw new NotFoundException('Item não encontrado neste leilão.');
    if (!this.isEligible(participant.character, item)) {
      throw new ForbiddenException('Você não atinge o nível mínimo exigido para este item.');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${participant.characterId})::bigint)`;

      const freshItem = await tx.auctionItem.findUnique({
        where: { id: auctionItemId },
        select: { resolutionStatus: true },
      });
      if (!freshItem || freshItem.resolutionStatus !== 'PENDING') {
        throw new BadRequestException('Este item já foi resolvido e não aceita mais lances.');
      }
      // Quem já desistiu PODE igualar o lance líder (volta a participar) —
      // mesma regra do placeBid, a marca de desistência some no mesmo passo.
      const itemWithdrawals = await tx.auctionItemWithdrawal.findMany({
        where: { auctionItemId },
        select: { characterId: true },
      });
      const withdrawnIds = itemWithdrawals.map((w) => w.characterId);

      const leadingAgg = await tx.bid.aggregate({
        where: { auctionItemId, characterId: { notIn: withdrawnIds } },
        _max: { amount: true },
      });
      const leadingAmount = leadingAgg._max.amount ?? 0;
      if (leadingAmount <= 0) {
        throw new BadRequestException('Ainda não há lance líder para igualar neste item.');
      }

      const ownAgg = await tx.bid.aggregate({
        where: { auctionItemId, characterId: participant.characterId },
        _max: { amount: true },
      });
      const ownAmount = ownAgg._max.amount ?? 0;
      if (ownAmount >= leadingAmount) {
        throw new BadRequestException('Você já está empatado ou liderando este item.');
      }

      const walletBalance = await this.getBalanceTx(tx, participant.characterId);
      const hold = await this.computeHoldTx(tx, participant.characterId, auctionItemId);
      const available = walletBalance - hold;

      if (available < leadingAmount) {
        throw new BadRequestException(
          `Saldo disponível insuficiente para igualar este lance. Você tem ${available} disponível e precisa de ${leadingAmount}.`,
        );
      }
      if (available > leadingAmount) {
        throw new BadRequestException(
          `Você ainda tem saldo pra superar o lance atual (disponível: ${available}) — o botão Igualar só funciona quando for sua aposta máxima (all-in). Dê um lance maior no campo acima.`,
        );
      }

      if (withdrawnIds.includes(participant.characterId)) {
        await tx.auctionItemWithdrawal.deleteMany({
          where: { auctionItemId, characterId: participant.characterId },
        });
      }

      return tx.bid.create({
        data: { auctionItemId, characterId: participant.characterId, amount: leadingAmount },
      });
    });
  }

  /**
   * Jogador desiste de um item em que já deu lance. O lance nunca é
   * apagado (Bid é append-only) — só passa a ser ignorado nos cálculos de
   * líder/hold/vitória a partir de agora. Trava por ITEM (não por
   * personagem, diferente do placeBid) pra serializar duas desistências
   * concorrentes no mesmo item — essencial pra regra de segurança: se restar
   * só 1 concorrente ativo com lance, ele vence *na hora*, então a contagem
   * de "quem ainda está dentro" precisa ser atômica e consistente. Isso não
   * bloqueia ninguém de desistir — inclusive o último a decidir sair ainda
   * consegue, contanto que chegue antes do córdão da 2ª-pra-última pessoa
   * fechar a transação (não há como "travar" a saída de alguém só porque
   * ele seria o vencedor).
   */
  async withdrawFromItem(code: string, auctionItemId: string) {
    const itemRef = await this.prisma.auctionItem.findUnique({
      where: { id: auctionItemId },
      select: { auctionId: true },
    });
    if (!itemRef) throw new NotFoundException('Item não encontrado.');

    const participant = await this.resolveParticipant(code, itemRef.auctionId);
    const auction = participant.auction;

    if (auction.status !== 'OPEN' || !auction.expiresAt || auction.expiresAt <= new Date()) {
      throw new BadRequestException('Este leilão não está mais aberto.');
    }
    const item = auction.items.find((i) => i.id === auctionItemId);
    if (!item) throw new NotFoundException('Item não encontrado neste leilão.');
    const hasBid = item.bids.some((b) => b.characterId === participant.characterId);
    if (!hasBid) {
      throw new BadRequestException('Você não tem lance neste item pra desistir.');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${auctionItemId})::bigint)`;

      const freshItem = await tx.auctionItem.findUnique({
        where: { id: auctionItemId },
        include: { bids: true, withdrawals: true },
      });
      if (!freshItem || freshItem.resolutionStatus !== 'PENDING') {
        throw new BadRequestException('Este item já foi resolvido.');
      }
      if (freshItem.withdrawals.some((w) => w.characterId === participant.characterId)) {
        throw new BadRequestException('Você já desistiu deste item.');
      }

      await tx.auctionItemWithdrawal.create({
        data: { auctionItemId, characterId: participant.characterId },
      });

      const withdrawnIds = new Set([
        ...freshItem.withdrawals.map((w) => w.characterId),
        participant.characterId,
      ]);
      const activeBidderIds = new Set(
        freshItem.bids.filter((b) => !withdrawnIds.has(b.characterId)).map((b) => b.characterId),
      );

      if (activeBidderIds.size === 1) {
        // Só sobrou 1 concorrente com lance — ele vence na hora, sem
        // precisar esperar o leilão expirar. Sem empate possível aqui (só
        // tem 1 pessoa), então nunca precisa de desempate no dado.
        const winnerCharacterId = Array.from(activeBidderIds)[0];
        const winnerBids = freshItem.bids.filter((b) => b.characterId === winnerCharacterId);
        const winningBid = winnerBids.reduce((best, b) => (b.amount > best.amount ? b : best), winnerBids[0]);

        await tx.ledgerTransaction.create({
          data: {
            characterId: winnerCharacterId,
            amount: -winningBid.amount,
            type: 'AUCTION_WIN_BURN',
            auctionItemId,
          },
        });
        await tx.auctionItem.update({
          where: { id: auctionItemId },
          data: { resolutionStatus: 'WON', winningBidId: winningBid.id, resolvedAt: new Date() },
        });
      }
      // Se sobrar 0 ou 2+ concorrentes ativos, nada muda — item continua
      // PENDING, aberto pra quem ainda não deu lance também. "Não
      // reclamado" só é decidido de verdade no fechamento do leilão
      // (resolvePendingItem), nunca no momento da desistência — corrigido
      // em 2026-08-12: antes, 0 concorrentes ativos fechava o item na hora
      // como "Não reclamado", mesmo com o leilão ainda aberto por dias,
      // tirando a chance de outros elegíveis que ainda não tinham dado
      // lance disputarem o item até o prazo real.

      return { withdrawn: true };
    });
  }

  /**
   * GM encerra um item específico antes da hora (motivo obrigatório). Só
   * itens ainda PENDING de um leilão OPEN — nada acontece com saldo porque
   * nada tinha sido debitado ainda (hold é só cálculo, nunca débito real);
   * a partir daqui o item para de contar em qualquer hold, liberando o
   * valor "reservado" dos jogadores imediatamente.
   */
  async cancelItem(auctionId: string, itemId: string, reason: string) {
    if (!reason?.trim()) throw new BadRequestException('Motivo é obrigatório pra encerrar um item.');
    const auction = await this.prisma.auction.findUnique({ where: { id: auctionId } });
    if (!auction) throw new NotFoundException('Leilão não encontrado.');
    if (auction.status !== 'OPEN') {
      throw new BadRequestException('Só é possível encerrar um item de um leilão publicado e aberto.');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${itemId})::bigint)`;
      const item = await tx.auctionItem.findUnique({ where: { id: itemId } });
      if (!item || item.auctionId !== auctionId) throw new NotFoundException('Item não encontrado neste leilão.');
      if (item.resolutionStatus !== 'PENDING') {
        throw new BadRequestException('Este item já foi resolvido.');
      }
      return tx.auctionItem.update({
        where: { id: itemId },
        data: { resolutionStatus: 'CANCELLED', cancelReason: reason.trim(), resolvedAt: new Date() },
      });
    });
  }

  /**
   * Resolve UM item PENDING — mesma lógica usada no fechamento automático
   * (resolveExpiredAuctions) e agora também no manual (closeAuction): sem
   * lance ativo nenhum vira UNCLAIMED; com lance, o maior ganha (empate
   * resolvido por dado), queima o valor do vencedor e marca WON. Extraído
   * em 2026-08-09 — antes closeAuction simplesmente cancelava todo item
   * PENDING, mesmo os que já tinham um lance/vencedor de verdade.
   */
  private async resolvePendingItem(tx: Prisma.TransactionClient, item: ResolvableItem) {
    const withdrawnIds = new Set(item.withdrawals.map((w) => w.characterId));
    const activeBids = item.bids.filter((b) => !withdrawnIds.has(b.characterId));

    if (activeBids.length === 0) {
      await tx.auctionItem.update({
        where: { id: item.id },
        data: { resolutionStatus: 'UNCLAIMED', resolvedAt: new Date() },
      });
      return;
    }

    const leadingAmount = activeBids.reduce((max, b) => Math.max(max, b.amount), 0);
    const leaderBidsByCharacter = new Map<string, (typeof activeBids)[number]>();
    for (const bid of activeBids) {
      if (bid.amount === leadingAmount) leaderBidsByCharacter.set(bid.characterId, bid);
    }
    const tiedBids = Array.from(leaderBidsByCharacter.values());

    let winningBid = tiedBids[0];
    let diceRollDetail: unknown = null;
    if (tiedBids.length > 1) {
      // Desempate por 2d6 (2 dados de 6 lados) — se o maior empatar entre
      // 2+ pessoas, só o subgrupo empatado rola de novo, até decidir. Todas
      // as rodadas ficam salvas pra transparência pública total (ver
      // PublicAuctionDetailPage) — não é só o resultado final.
      const result = rollTiebreakDice(
        tiedBids.map((bid) => ({ characterId: bid.characterId, gameName: bid.character.gameName })),
      );
      winningBid = tiedBids.find((b) => b.characterId === result.winnerCharacterId)!;
      diceRollDetail = result;
    }

    await tx.ledgerTransaction.create({
      data: {
        characterId: winningBid.characterId,
        amount: -winningBid.amount,
        type: 'AUCTION_WIN_BURN',
        auctionItemId: item.id,
      },
    });
    await tx.auctionItem.update({
      where: { id: item.id },
      data: {
        resolutionStatus: 'WON',
        winningBidId: winningBid.id,
        diceRollDetail: diceRollDetail as any,
        resolvedAt: new Date(),
      },
    });
  }

  /**
   * GM encerra o leilão inteiro antes da hora (motivo obrigatório, documenta
   * por que fechou antes do horário programado) — cada item ainda PENDING
   * é resolvido de verdade (mesma regra do fechamento automático: quem
   * já tinha o maior lance ganha), não simplesmente cancelado. Saldo
   * "reservado" de quem não venceu libera na hora (nunca houve débito real,
   * só deixa de contar no hold).
   */
  async closeAuction(auctionId: string, reason: string) {
    if (!reason?.trim()) throw new BadRequestException('Motivo é obrigatório pra encerrar o leilão.');
    const auction = await this.prisma.auction.findUnique({
      where: { id: auctionId },
      include: {
        items: {
          where: { resolutionStatus: 'PENDING' },
          include: { bids: { include: { character: true } }, withdrawals: { select: { characterId: true } } },
        },
      },
    });
    if (!auction) throw new NotFoundException('Leilão não encontrado.');
    if (auction.status !== 'OPEN') {
      throw new BadRequestException('Só é possível encerrar um leilão publicado e aberto.');
    }

    const trimmedReason = reason.trim();
    const pendingItems = [...auction.items].sort((a, b) => a.id.localeCompare(b.id));

    return this.prisma.$transaction(async (tx) => {
      for (const item of pendingItems) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${item.id})::bigint)`;
      }
      for (const item of pendingItems) {
        await this.resolvePendingItem(tx, item);
      }
      return tx.auction.update({
        where: { id: auctionId },
        data: { status: 'CLOSED', closeReason: trimmedReason },
      });
    });
  }

  // ---------------------------------------------------------------------
  // Saldo / hold (duplica lógica simples de saldo do LedgerService — ver
  // nota em placeBid: precisa rodar na MESMA transação/lock do advisory
  // lock, então não pode delegar pro LedgerService que usa outra conexão).
  // ---------------------------------------------------------------------

  private async getBalance(characterId: string): Promise<number> {
    const result = await this.prisma.ledgerTransaction.aggregate({
      where: { characterId },
      _sum: { amount: true },
    });
    return result._sum.amount ?? 0;
  }

  private async getBalanceTx(tx: any, characterId: string): Promise<number> {
    const result = await tx.ledgerTransaction.aggregate({ where: { characterId }, _sum: { amount: true } });
    return result._sum.amount ?? 0;
  }

  /** Soma os lances em que o personagem está liderando (ou empatado) em itens abertos, exceto excludeItemId. */
  private async computeHold(characterId: string, excludeItemId: string | null): Promise<number> {
    return this.computeHoldTx(this.prisma, characterId, excludeItemId);
  }

  private async computeHoldTx(tx: any, characterId: string, excludeItemId: string | null): Promise<number> {
    const openItems = await tx.auctionItem.findMany({
      where: {
        auction: { status: 'OPEN', expiresAt: { gt: new Date() } },
        resolutionStatus: 'PENDING',
        ...(excludeItemId ? { id: { not: excludeItemId } } : {}),
      },
      select: {
        id: true,
        bids: { select: { characterId: true, amount: true } },
        withdrawals: { select: { characterId: true } },
      },
    });

    let hold = 0;
    for (const item of openItems as Array<{
      id: string;
      bids: { characterId: string; amount: number }[];
      withdrawals: { characterId: string }[];
    }>) {
      const withdrawnIds = new Set(item.withdrawals.map((w) => w.characterId));
      const activeBids = item.bids.filter((b) => !withdrawnIds.has(b.characterId));
      if (activeBids.length === 0) continue;
      const leadingAmount = activeBids.reduce((max, b) => Math.max(max, b.amount), 0);
      const ownBest = activeBids
        .filter((b) => b.characterId === characterId)
        .reduce((max, b) => Math.max(max, b.amount), 0);
      if (ownBest > 0 && ownBest === leadingAmount) {
        hold += leadingAmount;
      }
    }
    return hold;
  }

  // ---------------------------------------------------------------------
  // Resolução automática (cron)
  // ---------------------------------------------------------------------

  async resolveExpiredAuctions() {
    const expired = await this.prisma.auction.findMany({
      where: { status: 'OPEN', expiresAt: { lte: new Date() } },
      // Só itens ainda PENDING: um item já pode ter sido resolvido antes da
      // hora (vitória automática por desistência de todo mundo, ou
      // cancelado pelo GM) — reprocessá-lo aqui queimaria o vencedor de
      // novo (double-burn) ou sobrescreveria um cancelamento.
      include: {
        items: {
          where: { resolutionStatus: 'PENDING' },
          include: { bids: { include: { character: true } }, withdrawals: { select: { characterId: true } } },
        },
      },
    });

    for (const auction of expired) {
      for (const item of auction.items) {
        await this.prisma.$transaction((tx) => this.resolvePendingItem(tx, item));
      }

      await this.prisma.auction.update({ where: { id: auction.id }, data: { status: 'CLOSED' } });
    }

    return { resolvedAuctions: expired.length };
  }
}
