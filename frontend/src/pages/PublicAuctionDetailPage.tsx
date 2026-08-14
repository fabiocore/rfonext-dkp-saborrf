import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { fetchGuildSettings, fetchPublicAuctionDetail } from '../api/client';
import { TableScroll } from '../components/TableScroll';

/**
 * Desempate por dado, 100% público e auditável. Suporta 2 formatos:
 * o novo (2d6 por pessoa, com todas as rodadas — inclusive quando o próprio
 * dado empata e precisa rolar de novo) e o antigo (1 dado só, 1 rodada, de
 * leilões encerrados antes desta mudança) — pra não quebrar o histórico já
 * publicado.
 */
function DiceTiebreakDetail({ detail }: { detail: unknown }) {
  const { t } = useTranslation();
  const d = detail as any;
  if (!d) return null;

  if (Array.isArray(d.rounds)) {
    return (
      <div>
        <p className="subtitle">{t('auctions.diceTiebreakIntro')}</p>
        {d.rounds.map((round: any, idx: number) => {
          const isLast = idx === d.rounds.length - 1;
          const rollsText = round.rolls
            .map((r: any) => `${r.gameName} 🎲${r.die1}+🎲${r.die2}=${r.total}`)
            .join(', ');
          return (
            <p key={idx} className="subtitle">
              {t('auctions.diceRound', { round: idx + 1, rolls: rollsText })}
              {!isLast && ` — ${t('auctions.diceDraw')}`}
            </p>
          );
        })}
      </div>
    );
  }

  if (Array.isArray(d.rolls)) {
    return (
      <p className="subtitle">
        {t('auctions.diceTiebreak', { rolls: d.rolls.map((r: any) => `${r.gameName} ${r.roll}`).join(', ') })}
      </p>
    );
  }

  return null;
}

export function PublicAuctionDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const auctionQuery = useQuery({
    queryKey: ['public-auction', id],
    queryFn: () => fetchPublicAuctionDetail(id!),
    enabled: !!id,
    refetchInterval: 8000,
  });
  const settingsQuery = useQuery({ queryKey: ['guild-settings'], queryFn: fetchGuildSettings });
  const currencyAbbr = settingsQuery.data?.currencyAbbr ?? '';

  const auction = auctionQuery.data;
  if (!auction) return <p>{t('common.loading')}</p>;

  return (
    <section>
      <h1>{auction.title}</h1>
      <p className="subtitle">
        {auction.status === 'OPEN'
          ? `${t('auctions.statusOpen')} — ${t('auctions.expiresAt', { date: new Date(auction.expiresAt!).toLocaleString() })}`
          : t('auctions.statusClosed')}
        {auction.closeReason && ` — ${t('auctions.closeReason', { reason: auction.closeReason })}`}
      </p>

      {auction.items.map((item) => {
        const withdrawnIds = new Set(item.withdrawals.map((w) => w.characterId));
        return (
          <div key={item.id} className="auction-item-card">
            {item.imageUrl && (
              <img src={item.imageUrl} alt={item.name} style={{ maxWidth: 200, borderRadius: 8, marginBottom: 8 }} />
            )}
            <h3>
              {item.name}
              {item.protection && <span className="badge">{item.protection.name}</span>}
            </h3>
            {item.resolutionStatus === 'WON' && item.winningBid && (
              <div className="form-success">
                <p>
                  {t('auctions.winner', {
                    gameName: item.winningBid.character.gameName,
                    amount: item.winningBid.amount,
                    currencyAbbr,
                  })}
                </p>
                <DiceTiebreakDetail detail={item.diceRollDetail} />
              </div>
            )}
            {item.resolutionStatus === 'UNCLAIMED' && <p className="form-error">{t('auctions.unclaimed')}</p>}
            {item.resolutionStatus === 'CANCELLED' && (
              <p className="form-error">{t('auctions.itemCancelled', { reason: item.cancelReason })}</p>
            )}

            <TableScroll>
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>{t('auctions.bidCharacter')}</th>
                  <th>{t('auctions.bidAmount')}</th>
                </tr>
              </thead>
              <tbody>
                {item.bids
                  .slice()
                  .sort((a, b) => b.amount - a.amount)
                  .map((bid) => (
                    <tr key={bid.id}>
                      <td>
                        {bid.character.gameName}
                        {withdrawnIds.has(bid.characterId) && ` (${t('auctions.withdrawn')})`}
                      </td>
                      <td>{t('common.amount', { amount: bid.amount, currencyAbbr })}</td>
                    </tr>
                  ))}
                {item.bids.length === 0 && (
                  <tr>
                    <td colSpan={2}>{t('auctions.noBidsYet')}</td>
                  </tr>
                )}
              </tbody>
            </table>
            </TableScroll>
          </div>
        );
      })}
    </section>
  );
}
