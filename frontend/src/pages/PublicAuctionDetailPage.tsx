import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { fetchGuildSettings, fetchPublicAuctionDetail } from '../api/client';

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
              <p className="form-success">
                {t('auctions.winner', {
                  gameName: item.winningBid.character.gameName,
                  amount: item.winningBid.amount,
                  currencyAbbr,
                })}
                {Array.isArray((item.diceRollDetail as any)?.rolls) &&
                  t('auctions.diceTiebreak', {
                    rolls: (item.diceRollDetail as any).rolls.map((r: any) => `${r.gameName} ${r.roll}`).join(', '),
                  })}
              </p>
            )}
            {item.resolutionStatus === 'UNCLAIMED' && <p className="form-error">{t('auctions.unclaimed')}</p>}
            {item.resolutionStatus === 'CANCELLED' && (
              <p className="form-error">{t('auctions.itemCancelled', { reason: item.cancelReason })}</p>
            )}

            <div className="table-scroll">
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
            </div>
          </div>
        );
      })}
    </section>
  );
}
