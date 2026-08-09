import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { fetchPublicAuctions } from '../api/client';

export function PublicAuctionsListPage() {
  const { t } = useTranslation();
  const auctionsQuery = useQuery({ queryKey: ['public-auctions'], queryFn: fetchPublicAuctions });

  const statusLabel: Record<string, string> = {
    OPEN: t('auctions.statusOpen'),
    CLOSED: t('auctions.statusClosed'),
  };

  return (
    <section>
      <h1>{t('auctions.listTitle')}</h1>
      <p className="subtitle">{t('auctions.listSubtitle')}</p>

      {auctionsQuery.data?.length === 0 && <p>{t('auctions.empty')}</p>}

      <table className="leaderboard-table">
        <thead>
          <tr>
            <th>{t('auctions.title')}</th>
            <th>{t('auctions.status')}</th>
            <th>{t('auctions.items')}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {auctionsQuery.data?.map((auction) => (
            <tr key={auction.id}>
              <td>{auction.title}</td>
              <td>{statusLabel[auction.status] ?? auction.status}</td>
              <td>{auction.items.length}</td>
              <td>
                <Link to={`/leiloes/${auction.id}`}>{t('auctions.view')}</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
