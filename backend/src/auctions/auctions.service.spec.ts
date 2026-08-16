import { Test } from '@nestjs/testing';
import { AuctionsService } from './auctions.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Integração de verdade contra o Postgres do ambiente de desenvolvimento —
 * sem mock de Prisma, porque o que estamos validando é justamente a regra
 * de negócio (saldo disponível == lance líder, all-in de verdade) calculada
 * a partir de dados reais (ledger + bids + holds). Cria/limpa os próprios
 * dados de teste.
 */
describe('AuctionsService.matchLeadingBid (integração)', () => {
  let service: AuctionsService;
  let prisma: PrismaService;

  let auctionId: string;
  let itemWithLeaderId: string;
  let itemNoBidsId: string;
  let itemProtectedId: string;
  let protectionId: string;

  let charLeaderId: string;
  let charLeaderCode: string;
  let charAllInId: string;
  let charAllInCode: string;
  let charInsufficientId: string;
  let charInsufficientCode: string;
  let charOverfundedId: string;
  let charOverfundedCode: string;
  let charNoLeadingBidId: string;
  let charNoLeadingBidCode: string;
  let charIneligibleId: string;
  let charIneligibleCode: string;

  const characterNames = [
    'IntegTestMatch_Leader',
    'IntegTestMatch_AllIn',
    'IntegTestMatch_Insufficient',
    'IntegTestMatch_Overfunded',
    'IntegTestMatch_NoLeadingBid',
    'IntegTestMatch_Ineligible',
  ];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [AuctionsService, PrismaService],
    }).compile();
    service = moduleRef.get(AuctionsService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();

    await prisma.guildSettings.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1, guildName: 'IntegTest Guild' },
    });

    const protection = await prisma.protection.create({
      data: { name: 'IntegTestMatch_Protecao', description: 'teste', minBid: 10, minLevel: 50 },
    });
    protectionId = protection.id;

    const auction = await prisma.auction.create({
      data: {
        title: 'IntegTestMatch_Leilao',
        status: 'OPEN',
        publishedAt: new Date(),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        createdById: 'integtest',
      },
    });
    auctionId = auction.id;

    const itemWithLeader = await prisma.auctionItem.create({
      data: { auctionId, name: 'IntegTestMatch_ItemComLider' },
    });
    itemWithLeaderId = itemWithLeader.id;

    const itemNoBids = await prisma.auctionItem.create({
      data: { auctionId, name: 'IntegTestMatch_ItemSemLances' },
    });
    itemNoBidsId = itemNoBids.id;

    const itemProtected = await prisma.auctionItem.create({
      data: { auctionId, name: 'IntegTestMatch_ItemProtegido', protectionId },
    });
    itemProtectedId = itemProtected.id;

    const [leader, allIn, insufficient, overfunded, noLeadingBid, ineligible] = await Promise.all(
      characterNames.map((gameName) =>
        prisma.character.create({
          data: { gameName, status: 'PRINCIPAL', membershipStatus: 'ACTIVE', level: 60, auctionAccessCode: gameName },
        }),
      ),
    );
    charLeaderId = leader.id;
    charLeaderCode = leader.auctionAccessCode!;
    charAllInId = allIn.id;
    charAllInCode = allIn.auctionAccessCode!;
    charInsufficientId = insufficient.id;
    charInsufficientCode = insufficient.auctionAccessCode!;
    charOverfundedId = overfunded.id;
    charOverfundedCode = overfunded.auctionAccessCode!;
    charNoLeadingBidId = noLeadingBid.id;
    charNoLeadingBidCode = noLeadingBid.auctionAccessCode!;
    charIneligibleId = ineligible.id;
    charIneligibleCode = ineligible.auctionAccessCode!;
    // Personagem inelegível pro item protegido (nível mínimo 50).
    await prisma.character.update({ where: { id: charIneligibleId }, data: { level: 10 } });

    await prisma.auctionParticipant.createMany({
      data: [charLeaderId, charAllInId, charInsufficientId, charOverfundedId, charNoLeadingBidId, charIneligibleId].map(
        (characterId) => ({ auctionId, characterId }),
      ),
    });

    // Lance líder em itemWithLeader e itemProtected: charLeader, 100.
    await prisma.bid.create({ data: { auctionItemId: itemWithLeaderId, characterId: charLeaderId, amount: 100 } });
    await prisma.bid.create({ data: { auctionItemId: itemProtectedId, characterId: charLeaderId, amount: 100 } });

    // Saldos via ajuste manual — cada personagem só tem saldo pro próprio cenário.
    await prisma.ledgerTransaction.createMany({
      data: [
        { characterId: charAllInId, amount: 100, type: 'GM_MANUAL_ADJUSTMENT' },
        { characterId: charInsufficientId, amount: 50, type: 'GM_MANUAL_ADJUSTMENT' },
        { characterId: charOverfundedId, amount: 500, type: 'GM_MANUAL_ADJUSTMENT' },
        { characterId: charNoLeadingBidId, amount: 1000, type: 'GM_MANUAL_ADJUSTMENT' },
        { characterId: charIneligibleId, amount: 100, type: 'GM_MANUAL_ADJUSTMENT' },
      ],
    });
  });

  afterAll(async () => {
    const characterIds = [
      charLeaderId,
      charAllInId,
      charInsufficientId,
      charOverfundedId,
      charNoLeadingBidId,
      charIneligibleId,
    ];
    await prisma.ledgerTransaction.deleteMany({ where: { characterId: { in: characterIds } } });
    await prisma.bid.deleteMany({ where: { auctionItemId: { in: [itemWithLeaderId, itemNoBidsId, itemProtectedId] } } });
    await prisma.auctionParticipant.deleteMany({ where: { auctionId } });
    await prisma.auctionItem.deleteMany({ where: { auctionId } });
    await prisma.auction.delete({ where: { id: auctionId } });
    await prisma.character.deleteMany({ where: { id: { in: characterIds } } });
    await prisma.protection.delete({ where: { id: protectionId } });
    await prisma.$disconnect();
  });

  it('aceita quando o saldo disponível é EXATAMENTE igual ao lance líder (all-in de verdade)', async () => {
    const bid = await service.matchLeadingBid(charAllInCode, itemWithLeaderId);
    expect(bid.amount).toBe(100);
    expect(bid.characterId).toBe(charAllInId);
  });

  it('rejeita quando o personagem já está liderando/empatado no item', async () => {
    await expect(service.matchLeadingBid(charLeaderCode, itemWithLeaderId)).rejects.toThrow(
      /já está empatado ou liderando/i,
    );
  });

  it('rejeita quando o saldo disponível é MENOR que o lance líder, com o valor explicado na mensagem', async () => {
    await expect(service.matchLeadingBid(charInsufficientCode, itemWithLeaderId)).rejects.toThrow(
      /saldo disponível insuficiente/i,
    );
  });

  it('rejeita quando o saldo disponível é MAIOR que o lance líder — não é all-in, precisa usar o lance normal', async () => {
    await expect(service.matchLeadingBid(charOverfundedCode, itemWithLeaderId)).rejects.toThrow(
      /ainda tem saldo/i,
    );
  });

  it('rejeita quando o item ainda não tem nenhum lance líder pra igualar', async () => {
    await expect(service.matchLeadingBid(charNoLeadingBidCode, itemNoBidsId)).rejects.toThrow(
      /não há lance líder/i,
    );
  });

  it('rejeita quando o personagem não atinge o nível mínimo da proteção do item', async () => {
    await expect(service.matchLeadingBid(charIneligibleCode, itemProtectedId)).rejects.toThrow(
      /não atinge o nível mínimo/i,
    );
  });

  it('rejeita código de leilão inválido', async () => {
    await expect(service.matchLeadingBid('CODIGO-INEXISTENTE', itemWithLeaderId)).rejects.toThrow(/código inválido/i);
  });
});

/**
 * O dropdown do front já filtra proteção desativada (AuctionBuilderPage),
 * mas isso sozinho é frágil — cache desatualizada, outra aba, ou chamada
 * direta na API ainda conseguiam anexar uma proteção desativada a um item
 * novo. Esses testes cobrem a trava de verdade, no backend.
 */
describe('AuctionsService.addItem / updateItem — proteção desativada (integração)', () => {
  let service: AuctionsService;
  let prisma: PrismaService;

  let auctionId: string;
  let activeProtectionId: string;
  let inactiveProtectionId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [AuctionsService, PrismaService],
    }).compile();
    service = moduleRef.get(AuctionsService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();

    const auction = await prisma.auction.create({
      data: { title: 'IntegTestProtection_Leilao', status: 'DRAFT', createdById: 'integtest' },
    });
    auctionId = auction.id;

    const active = await prisma.protection.create({
      data: { name: 'IntegTestProtection_Ativa', description: 'teste', minBid: 10, minLevel: 1, isActive: true },
    });
    activeProtectionId = active.id;

    const inactive = await prisma.protection.create({
      data: { name: 'IntegTestProtection_Inativa', description: 'teste', minBid: 10, minLevel: 1, isActive: false },
    });
    inactiveProtectionId = inactive.id;
  });

  afterAll(async () => {
    await prisma.auctionItem.deleteMany({ where: { auctionId } });
    await prisma.auction.delete({ where: { id: auctionId } });
    await prisma.protection.deleteMany({ where: { id: { in: [activeProtectionId, inactiveProtectionId] } } });
    await prisma.$disconnect();
  });

  it('addItem rejeita proteção desativada', async () => {
    await expect(
      service.addItem(auctionId, { name: 'Item teste', protectionId: inactiveProtectionId }),
    ).rejects.toThrow(/desativada/i);
  });

  it('addItem aceita proteção ativa', async () => {
    const item = await service.addItem(auctionId, { name: 'Item teste ativa', protectionId: activeProtectionId });
    expect(item.protectionId).toBe(activeProtectionId);
  });

  it('addItem aceita sem proteção nenhuma', async () => {
    const item = await service.addItem(auctionId, { name: 'Item teste sem protecao' });
    expect(item.protectionId).toBeNull();
  });

  it('addItem rejeita id de proteção inexistente', async () => {
    await expect(
      service.addItem(auctionId, { name: 'Item teste', protectionId: 'id-que-nao-existe' }),
    ).rejects.toThrow(/não encontrada/i);
  });

  it('updateItem rejeita trocar pra proteção desativada', async () => {
    const item = await service.addItem(auctionId, { name: 'Item pra editar' });
    await expect(
      service.updateItem(auctionId, item.id, { protectionId: inactiveProtectionId }),
    ).rejects.toThrow(/desativada/i);
  });

  it('updateItem aceita remover a proteção (protectionId: null)', async () => {
    const item = await service.addItem(auctionId, { name: 'Item pra limpar', protectionId: activeProtectionId });
    const updated = await service.updateItem(auctionId, item.id, { protectionId: null });
    expect(updated.protectionId).toBeNull();
  });
});

/**
 * Até aqui, desistir de um item era permanente: placeBid/matchLeadingBid
 * rejeitavam qualquer tentativa de lance de quem já tinha desistido daquele
 * item específico. Passa a ser permitido voltar a participar dando um novo
 * lance (ou usando "Igualar") — a marca de desistência (AuctionItemWithdrawal)
 * é removida no mesmo passo do novo lance, sem afetar histórico de Bid
 * (append-only) nem a regra de resolução automática quando só resta 1
 * concorrente ativo.
 */
describe('AuctionsService — lance apos desistencia (integracao)', () => {
  let service: AuctionsService;
  let prisma: PrismaService;

  let auctionId: string;
  let itemMultiId: string;
  let itemOwnAmountId: string;
  let itemMatchId: string;
  let itemSoloWinId: string;

  let charAId: string;
  let charBId: string;
  let charCId: string, charCCode: string;
  let charThirdId: string;
  let charAllInId: string, charAllInCode: string;
  let charBCode: string;

  const characterNames = [
    'IntegTestRebid_A',
    'IntegTestRebid_B',
    'IntegTestRebid_C',
    'IntegTestRebid_Third',
    'IntegTestRebid_AllIn',
  ];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [AuctionsService, PrismaService],
    }).compile();
    service = moduleRef.get(AuctionsService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();

    await prisma.guildSettings.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1, guildName: 'IntegTest Guild' },
    });

    const auction = await prisma.auction.create({
      data: {
        title: 'IntegTestRebid_Leilao',
        status: 'OPEN',
        publishedAt: new Date(),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        createdById: 'integtest',
      },
    });
    auctionId = auction.id;

    const [itemMulti, itemOwnAmount, itemMatch, itemSoloWin] = await Promise.all([
      prisma.auctionItem.create({ data: { auctionId, name: 'IntegTestRebid_ItemMulti' } }),
      prisma.auctionItem.create({ data: { auctionId, name: 'IntegTestRebid_ItemOwnAmount' } }),
      prisma.auctionItem.create({ data: { auctionId, name: 'IntegTestRebid_ItemMatch' } }),
      prisma.auctionItem.create({ data: { auctionId, name: 'IntegTestRebid_ItemSoloWin' } }),
    ]);
    itemMultiId = itemMulti.id;
    itemOwnAmountId = itemOwnAmount.id;
    itemMatchId = itemMatch.id;
    itemSoloWinId = itemSoloWin.id;

    const [charA, charB, charC, charThird, charAllIn] = await Promise.all(
      characterNames.map((gameName) =>
        prisma.character.create({
          data: { gameName, status: 'PRINCIPAL', membershipStatus: 'ACTIVE', level: 60, auctionAccessCode: gameName },
        }),
      ),
    );
    charAId = charA.id;
    charBId = charB.id;
    charBCode = charB.auctionAccessCode!;
    charCId = charC.id;
    charCCode = charC.auctionAccessCode!;
    charThirdId = charThird.id;
    charAllInId = charAllIn.id;
    charAllInCode = charAllIn.auctionAccessCode!;

    await prisma.auctionParticipant.createMany({
      data: [charAId, charBId, charCId, charThirdId, charAllInId].map((characterId) => ({ auctionId, characterId })),
    });

    // itemMulti: A=50, B=40, C=30 — C desiste e volta a dar lance (2 concorrentes ativos sobram, não resolve sozinho).
    await prisma.bid.create({ data: { auctionItemId: itemMultiId, characterId: charAId, amount: 50 } });
    await prisma.bid.create({ data: { auctionItemId: itemMultiId, characterId: charBId, amount: 40 } });
    await prisma.bid.create({ data: { auctionItemId: itemMultiId, characterId: charCId, amount: 30 } });

    // itemOwnAmount: só C tem lance (40) — desistir aqui não resolve nada (0 concorrentes ativos sobram).
    await prisma.bid.create({ data: { auctionItemId: itemOwnAmountId, characterId: charCId, amount: 40 } });

    // itemMatch: A=100 (líder), Third=10, AllIn=20 — AllIn desiste (2 concorrentes ativos sobram) e depois iguala o líder.
    await prisma.bid.create({ data: { auctionItemId: itemMatchId, characterId: charAId, amount: 100 } });
    await prisma.bid.create({ data: { auctionItemId: itemMatchId, characterId: charThirdId, amount: 10 } });
    await prisma.bid.create({ data: { auctionItemId: itemMatchId, characterId: charAllInId, amount: 20 } });

    // itemSoloWin: A=100, B=30 — B desiste, só sobra A ativo → resolve na hora (WON), B não pode mais voltar.
    await prisma.bid.create({ data: { auctionItemId: itemSoloWinId, characterId: charAId, amount: 100 } });
    await prisma.bid.create({ data: { auctionItemId: itemSoloWinId, characterId: charBId, amount: 30 } });

    await prisma.ledgerTransaction.createMany({
      data: [
        { characterId: charAId, amount: 150, type: 'GM_MANUAL_ADJUSTMENT' },
        { characterId: charCId, amount: 300, type: 'GM_MANUAL_ADJUSTMENT' },
        { characterId: charAllInId, amount: 100, type: 'GM_MANUAL_ADJUSTMENT' },
      ],
    });
  });

  afterAll(async () => {
    const characterIds = [charAId, charBId, charCId, charThirdId, charAllInId];
    await prisma.ledgerTransaction.deleteMany({ where: { characterId: { in: characterIds } } });
    const itemIds = [itemMultiId, itemOwnAmountId, itemMatchId, itemSoloWinId];
    await prisma.auctionItemWithdrawal.deleteMany({ where: { auctionItemId: { in: itemIds } } });
    await prisma.bid.deleteMany({ where: { auctionItemId: { in: itemIds } } });
    await prisma.auctionParticipant.deleteMany({ where: { auctionId } });
    await prisma.auctionItem.deleteMany({ where: { auctionId } });
    await prisma.auction.delete({ where: { id: auctionId } });
    await prisma.character.deleteMany({ where: { id: { in: characterIds } } });
    await prisma.$disconnect();
  });

  it('aceita novo lance depois de desistir, e some a marca de desistência', async () => {
    await service.withdrawFromItem(charCCode, itemMultiId);
    const bid = await service.placeBid(charCCode, itemMultiId, 60);
    expect(bid.amount).toBe(60);
    expect(bid.characterId).toBe(charCId);

    const withdrawal = await prisma.auctionItemWithdrawal.findFirst({
      where: { auctionItemId: itemMultiId, characterId: charCId },
    });
    expect(withdrawal).toBeNull();
  });

  it('novo lance ainda precisa superar o próprio lance anterior, de antes da desistência', async () => {
    await service.withdrawFromItem(charCCode, itemOwnAmountId);
    await expect(service.placeBid(charCCode, itemOwnAmountId, 40)).rejects.toThrow(
      /maior que o seu lance anterior/i,
    );

    const bid = await service.placeBid(charCCode, itemOwnAmountId, 41);
    expect(bid.amount).toBe(41);
  });

  it('"Igualar Lance" também funciona pra quem desistiu e quer voltar all-in', async () => {
    await service.withdrawFromItem(charAllInCode, itemMatchId);
    const bid = await service.matchLeadingBid(charAllInCode, itemMatchId);
    expect(bid.amount).toBe(100);
    expect(bid.characterId).toBe(charAllInId);

    const withdrawal = await prisma.auctionItemWithdrawal.findFirst({
      where: { auctionItemId: itemMatchId, characterId: charAllInId },
    });
    expect(withdrawal).toBeNull();
  });

  it('item já resolvido (venceu sozinho após a desistência) continua bloqueado pra sempre', async () => {
    await service.withdrawFromItem(charBCode, itemSoloWinId);

    const item = await prisma.auctionItem.findUnique({ where: { id: itemSoloWinId } });
    expect(item?.resolutionStatus).toBe('WON');

    await expect(service.placeBid(charBCode, itemSoloWinId, 999)).rejects.toThrow(/já foi resolvido/i);
  });
});
