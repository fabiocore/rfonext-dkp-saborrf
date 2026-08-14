import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { fetchBalances, fetchGuildSettings } from '../api/client';
import { DefaultAvatar } from '../components/DefaultAvatar';
import { TableScroll } from '../components/TableScroll';

export function BalancesPage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);

  const settingsQuery = useQuery({ queryKey: ['guild-settings'], queryFn: fetchGuildSettings });
  const balancesQuery = useQuery({ queryKey: ['balances', page], queryFn: () => fetchBalances({ page }) });

  const currencyName = settingsQuery.data?.currencyName ?? '';
  const items = balancesQuery.data?.items ?? [];
  const total = balancesQuery.data?.total ?? 0;
  const totalPages = balancesQuery.data?.totalPages ?? 1;

  return (
    <section>
      <h1>{t('balances.title', { currencyName })}</h1>
      <p className="subtitle">{t('balances.subtitle')}</p>

      {balancesQuery.isLoading && <p>{t('common.loading')}</p>}
      {balancesQuery.isError && <p role="alert">{t('common.error')}</p>}

      {balancesQuery.data && items.length === 0 && <p>{t('balances.empty')}</p>}

      {items.length > 0 && (
        <TableScroll>
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th>{t('balances.character')}</th>
              <th>{t('balances.level')}</th>
              <th>{t('common.balance')}</th>
              <th>{t('balances.reserved')}</th>
              <th>{t('balances.available')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((entry) => (
              <tr key={entry.id}>
                <td>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    {entry.avatarUrl ? (
                      <img
                        src={entry.avatarUrl}
                        alt=""
                        style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                      />
                    ) : (
                      <DefaultAvatar size={32} />
                    )}
                    {entry.gameName}
                  </span>
                </td>
                <td>{entry.level ?? '-'}</td>
                <td>
                  {entry.balance} {settingsQuery.data?.currencyAbbr}
                </td>
                <td>
                  {entry.hold > 0 ? `${entry.hold} ${settingsQuery.data?.currencyAbbr}` : '—'}
                </td>
                <td>
                  {entry.available} {settingsQuery.data?.currencyAbbr}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </TableScroll>
      )}

      {total > 0 && (
        <div className="pagination">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            {t('feed.prev')}
          </button>
          <span>{t('feed.pageInfo', { page, totalPages, total })}</span>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            {t('feed.next')}
          </button>
        </div>
      )}
    </section>
  );
}
