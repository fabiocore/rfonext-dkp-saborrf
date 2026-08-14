export interface OpenItemForHold {
  bids: { characterId: string; amount: number }[];
  withdrawals: { characterId: string }[];
}

/**
 * Quanto cada personagem tem reservado (hold) em lances líderes/empatados
 * de itens de leilão ainda em aberto — mesma regra usada em
 * `AuctionsService.computeHoldTx` (não reaproveitada de lá de propósito:
 * essa função é só de LEITURA, pra telas de exibição como Saldos públicos,
 * e não deve nunca ser tocada por mudanças no motor de leilão em si, nem
 * o motor de leilão deve depender dela). Calcula pra TODOS os personagens
 * de uma vez, a partir da lista de itens abertos já buscada — quem lidera
 * (ou empata no topo) um item tem o valor do lance líder retido; quem não
 * lidera não tem nada retido naquele item, mesmo tendo dado lance nele.
 */
export function computeHolds(openItems: OpenItemForHold[]): Map<string, number> {
  const holds = new Map<string, number>();

  for (const item of openItems) {
    const withdrawnIds = new Set(item.withdrawals.map((w) => w.characterId));
    const activeBids = item.bids.filter((b) => !withdrawnIds.has(b.characterId));
    if (activeBids.length === 0) continue;

    const bestByCharacter = new Map<string, number>();
    for (const bid of activeBids) {
      const current = bestByCharacter.get(bid.characterId) ?? 0;
      if (bid.amount > current) bestByCharacter.set(bid.characterId, bid.amount);
    }

    const leadingAmount = Math.max(...bestByCharacter.values());
    for (const [characterId, amount] of bestByCharacter) {
      if (amount === leadingAmount) {
        holds.set(characterId, (holds.get(characterId) ?? 0) + leadingAmount);
      }
    }
  }

  return holds;
}
