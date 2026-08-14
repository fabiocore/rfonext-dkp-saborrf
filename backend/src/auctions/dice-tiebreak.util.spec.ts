import { rollTiebreakDice } from './dice-tiebreak.util';

/**
 * RNG determinística pra controlar exatamente os valores dos dados nos
 * testes — cada chamada consome o próximo valor da fila (ordem de consumo:
 * candidato1.die1, candidato1.die2, candidato2.die1, candidato2.die2, ...).
 * `die = 1 + floor(valor * 6)`, então os valores abaixo já vêm calculados
 * pra dar o dado desejado (ex.: 0 -> 1, 0.99999 -> 6).
 */
function fakeRng(sequence: number[]): () => number {
  let i = 0;
  return () => {
    if (i >= sequence.length) throw new Error('fakeRng: sequência esgotada — teste precisa de mais valores.');
    return sequence[i++];
  };
}

const D = {
  1: 0,
  2: 1 / 6,
  3: 2 / 6,
  4: 3 / 6,
  5: 4 / 6,
  6: 5.999 / 6,
};

describe('rollTiebreakDice', () => {
  it('com 1 único candidato, vence direto sem precisar rolar contra ninguém', () => {
    const result = rollTiebreakDice(
      [{ characterId: 'a', gameName: 'Alpha' }],
      fakeRng([D[3], D[4]]),
    );
    expect(result.winnerCharacterId).toBe('a');
    expect(result.rounds).toHaveLength(1);
    expect(result.rounds[0].rolls).toEqual([{ characterId: 'a', gameName: 'Alpha', die1: 3, die2: 4, total: 7 }]);
    expect(result.rounds[0].tiedCharacterIds).toEqual([]);
  });

  it('dois candidatos com somas diferentes resolve na primeira rodada, sem empate', () => {
    const result = rollTiebreakDice(
      [
        { characterId: 'a', gameName: 'Alpha' },
        { characterId: 'b', gameName: 'Beta' },
      ],
      fakeRng([D[6], D[6], D[1], D[2]]), // Alpha: 6+6=12, Beta: 1+2=3
    );
    expect(result.rounds).toHaveLength(1);
    expect(result.winnerCharacterId).toBe('a');
    expect(result.rounds[0].tiedCharacterIds).toEqual([]);
  });

  it('empate na 1ª rodada gera 2ª rodada só entre quem empatou, e essa decide', () => {
    const result = rollTiebreakDice(
      [
        { characterId: 'a', gameName: 'Alpha' },
        { characterId: 'b', gameName: 'Beta' },
      ],
      fakeRng([
        D[3], D[4], // Alpha ronda 1: 7
        D[3], D[4], // Beta ronda 1: 7 (empate)
        D[6], D[6], // Alpha ronda 2: 12
        D[1], D[1], // Beta ronda 2: 2
      ]),
    );
    expect(result.rounds).toHaveLength(2);
    expect(result.rounds[0].tiedCharacterIds.sort()).toEqual(['a', 'b']);
    expect(result.rounds[1].tiedCharacterIds).toEqual([]);
    expect(result.winnerCharacterId).toBe('a');
  });

  it('com 3 candidatos, quem perdeu a 1ª rodada não participa da rodada de desempate', () => {
    const result = rollTiebreakDice(
      [
        { characterId: 'a', gameName: 'Alpha' },
        { characterId: 'b', gameName: 'Beta' },
        { characterId: 'c', gameName: 'Gamma' },
      ],
      fakeRng([
        D[6], D[6], // Alpha ronda 1: 12
        D[6], D[6], // Beta ronda 1: 12 (empate com Alpha)
        D[1], D[1], // Gamma ronda 1: 2 (eliminado)
        D[2], D[2], // Alpha ronda 2: 4
        D[5], D[5], // Beta ronda 2: 10
      ]),
    );
    expect(result.rounds).toHaveLength(2);
    expect(result.rounds[0].tiedCharacterIds.sort()).toEqual(['a', 'b']);
    expect(result.rounds[1].rolls).toHaveLength(2);
    expect(result.rounds[1].rolls.map((r) => r.characterId).sort()).toEqual(['a', 'b']);
    expect(result.winnerCharacterId).toBe('b');
  });

  it('empates seguidos continuam gerando novas rodadas até decidir', () => {
    const result = rollTiebreakDice(
      [
        { characterId: 'a', gameName: 'Alpha' },
        { characterId: 'b', gameName: 'Beta' },
      ],
      fakeRng([
        D[3], D[3], D[3], D[3], // ronda 1: Alpha 6 / Beta 6 — empate
        D[4], D[4], D[4], D[4], // ronda 2: Alpha 8 / Beta 8 — empate
        D[2], D[3], D[2], D[3], // ronda 3: Alpha 5 / Beta 5 — empate
        D[6], D[6], D[6], D[5], // ronda 4: Alpha 12 / Beta 11 — decide
      ]),
    );
    expect(result.rounds).toHaveLength(4);
    expect(result.rounds[0].tiedCharacterIds.sort()).toEqual(['a', 'b']);
    expect(result.rounds[1].tiedCharacterIds.sort()).toEqual(['a', 'b']);
    expect(result.rounds[2].tiedCharacterIds.sort()).toEqual(['a', 'b']);
    expect(result.rounds[3].tiedCharacterIds).toEqual([]);
    expect(result.winnerCharacterId).toBe('a');
  });

  it('trava de segurança: empate infinito não gera loop infinito nem exceção', () => {
    const alwaysTie = fakeRng(new Array(200).fill(D[3])); // sempre 3+3=6 pros dois
    const result = rollTiebreakDice(
      [
        { characterId: 'a', gameName: 'Alpha' },
        { characterId: 'b', gameName: 'Beta' },
      ],
      alwaysTie,
    );
    expect(result.winnerCharacterId).toBeDefined();
    expect(['a', 'b']).toContain(result.winnerCharacterId);
    expect(result.rounds.length).toBeGreaterThan(0);
    expect(result.rounds.length).toBeLessThanOrEqual(20);
  });

  it('lança erro se não houver nenhum candidato', () => {
    expect(() => rollTiebreakDice([], fakeRng([]))).toThrow();
  });
});
