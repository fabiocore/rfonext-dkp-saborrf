export interface DiceCandidate {
  characterId: string;
  gameName: string;
}

export interface DiceRoundRoll extends DiceCandidate {
  die1: number;
  die2: number;
  total: number;
}

export interface DiceRound {
  rolls: DiceRoundRoll[];
  // Quem seguiu empatado no topo dessa rodada (precisa rolar de novo). Vazio
  // quando a rodada já decidiu um vencedor único.
  tiedCharacterIds: string[];
}

export interface DiceTiebreakResult {
  rounds: DiceRound[];
  winnerCharacterId: string;
}

// Limite puramente defensivo: com 2d6 a chance de empate infinito é
// desprezível, mas isso roda dentro da transação que fecha o leilão — não
// pode nunca lançar exceção e travar a resolução de verdade. Se por algum
// motivo bizarro passar de 20 rodadas, a última rodada empatada decide por
// ordem determinística (primeiro da lista), só pra garantir que sempre
// termina.
const MAX_ROUNDS = 20;

/**
 * Desempate por 2 dados de 6 lados (2d6, soma 2–12) por candidato. Se o
 * maior valor empatar entre 2+ candidatos, só esse subgrupo rola de novo —
 * quem não empatou no topo já perdeu de vez, não volta pra próxima rodada.
 * Repete até sobrar 1 só. Todas as rodadas ficam no resultado, pra
 * transparência pública total (ver PublicAuctionDetailPage).
 */
export function rollTiebreakDice(candidates: DiceCandidate[], rng: () => number = Math.random): DiceTiebreakResult {
  if (candidates.length === 0) {
    throw new Error('rollTiebreakDice: precisa de ao menos 1 candidato.');
  }

  const rounds: DiceRound[] = [];
  let contenders = candidates;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const rolls: DiceRoundRoll[] = contenders.map((c) => {
      const die1 = 1 + Math.floor(rng() * 6);
      const die2 = 1 + Math.floor(rng() * 6);
      return { ...c, die1, die2, total: die1 + die2 };
    });

    const highest = rolls.reduce((max, r) => Math.max(max, r.total), 0);
    const tiedRolls = rolls.filter((r) => r.total === highest);
    const tiedCharacterIds = tiedRolls.length > 1 ? tiedRolls.map((r) => r.characterId) : [];
    rounds.push({ rolls, tiedCharacterIds });

    if (tiedRolls.length === 1) {
      return { rounds, winnerCharacterId: tiedRolls[0].characterId };
    }
    contenders = contenders.filter((c) => tiedCharacterIds.includes(c.characterId));
  }

  return { rounds, winnerCharacterId: contenders[0].characterId };
}
