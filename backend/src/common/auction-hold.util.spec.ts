import { computeHolds } from './auction-hold.util';

describe('computeHolds', () => {
  it('personagem líder sozinho tem o valor do próprio lance retido', () => {
    const holds = computeHolds([{ bids: [{ characterId: 'a', amount: 50 }], withdrawals: [] }]);
    expect(holds.get('a')).toBe(50);
  });

  it('quem não lidera não tem nada retido, mesmo tendo dado lance', () => {
    const holds = computeHolds([
      {
        bids: [
          { characterId: 'a', amount: 100 },
          { characterId: 'b', amount: 50 },
        ],
        withdrawals: [],
      },
    ]);
    expect(holds.get('a')).toBe(100);
    expect(holds.get('b')).toBeUndefined();
  });

  it('empate no topo: todos os empatados têm o valor líder retido', () => {
    const holds = computeHolds([
      {
        bids: [
          { characterId: 'a', amount: 100 },
          { characterId: 'b', amount: 100 },
        ],
        withdrawals: [],
      },
    ]);
    expect(holds.get('a')).toBe(100);
    expect(holds.get('b')).toBe(100);
  });

  it('considera só o MELHOR lance de cada personagem no item, não todos', () => {
    const holds = computeHolds([
      {
        bids: [
          { characterId: 'a', amount: 30 },
          { characterId: 'a', amount: 80 },
          { characterId: 'b', amount: 50 },
        ],
        withdrawals: [],
      },
    ]);
    expect(holds.get('a')).toBe(80);
    expect(holds.get('b')).toBeUndefined();
  });

  it('quem desistiu não conta pro líder nem tem nada retido', () => {
    const holds = computeHolds([
      {
        bids: [
          { characterId: 'a', amount: 100 },
          { characterId: 'b', amount: 50 },
        ],
        withdrawals: [{ characterId: 'a' }],
      },
    ]);
    expect(holds.get('a')).toBeUndefined();
    expect(holds.get('b')).toBe(50);
  });

  it('soma o hold de um mesmo personagem entre vários itens diferentes', () => {
    const holds = computeHolds([
      { bids: [{ characterId: 'a', amount: 30 }], withdrawals: [] },
      { bids: [{ characterId: 'a', amount: 70 }], withdrawals: [] },
    ]);
    expect(holds.get('a')).toBe(100);
  });

  it('item sem nenhum lance ativo não gera hold nenhum', () => {
    const holds = computeHolds([{ bids: [], withdrawals: [] }]);
    expect(holds.size).toBe(0);
  });

  it('lista vazia de itens retorna mapa vazio, sem erro', () => {
    const holds = computeHolds([]);
    expect(holds.size).toBe(0);
  });
});
