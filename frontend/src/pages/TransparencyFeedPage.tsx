import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { fetchBalances, fetchGuildSettings, fetchPublicFeed } from '../api/client';

export function TransparencyFeedPage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [characterId, setCharacterId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const balancesQuery = useQuery({
    queryKey: ['balances', 'filter-options'],
    queryFn: () => fetchBalances({ pageSize: 100 }),
  });
  const settingsQuery = useQuery({ queryKey: ['guild-settings'], queryFn: fetchGuildSettings });
  const currencyAbbr = settingsQuery.data?.currencyAbbr ?? '';

  const feedQuery = useQuery({
    queryKey: ['public-feed', page, characterId, fromDate, toDate],
    queryFn: () =>
      fetchPublicFeed({
        page,
        characterId: characterId || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      }),
  });

  const typeLabel: Record<string, string> = {
    TRANSFER_OUT: t('feed.typeTransfer'),
    GM_MANUAL_ADJUSTMENT: t('feed.typeManualAdjustment'),
    MANUAL_EVENT_EMISSION: t('feed.typeManualEvent'),
    ACTIVITY_EMISSION: t('feed.typeActivityEmission'),
    WEEKLY_TAX_BURN: t('feed.typeWeeklyTax'),
    AUCTION_WIN_REVERSAL: t('feed.typeAuctionReversal'),
  };

  function handleFilterChange(value: string) {
    setCharacterId(value);
    setPage(1);
  }

  function handleFromDateChange(value: string) {
    setFromDate(value);
    setPage(1);
  }

  function handleToDateChange(value: string) {
    setToDate(value);
    setPage(1);
  }

  function clearDateFilter() {
    setFromDate('');
    setToDate('');
    setPage(1);
  }

  const items = feedQuery.data?.items ?? [];
  const totalPages = feedQuery.data?.totalPages ?? 1;
  const total = feedQuery.data?.total ?? 0;

  return (
    <section>
      <h1>{t('feed.title')}</h1>
      <p className="subtitle">{t('feed.subtitle')}</p>

      <div className="inline-form">
        <label>
          {t('feed.filterLabel')}{' '}
          <select value={characterId} onChange={(e) => handleFilterChange(e.target.value)}>
            <option value="">{t('feed.filterAll')}</option>
            {balancesQuery.data?.items.map((c) => (
              <option key={c.id} value={c.id}>
                {c.gameName}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('feed.fromDate')}{' '}
          <input type="date" value={fromDate} onChange={(e) => handleFromDateChange(e.target.value)} />
        </label>
        <label>
          {t('feed.toDate')}{' '}
          <input type="date" value={toDate} onChange={(e) => handleToDateChange(e.target.value)} />
        </label>
        {(fromDate || toDate) && (
          <button type="button" onClick={clearDateFilter}>
            {t('feed.clearDateFilter')}
          </button>
        )}
      </div>

      {items.length === 0 && <p>{t('feed.empty')}</p>}

      {items.map((entry) => (
        <div key={entry.id} className="auction-item-card">
          <p>
            <strong>{typeLabel[entry.type] ?? entry.type}</strong> — {entry.character.gameName}:{' '}
            <span className={entry.amount >= 0 ? 'form-success' : 'form-error'}>
              {entry.amount >= 0 ? '+' : ''}
              {t('common.amount', { amount: entry.amount, currencyAbbr })}
            </span>
          </p>
          {entry.reasonText && <p>{t('feed.reason', { reason: entry.reasonText })}</p>}
          {entry.sourceActivity && <p>{t('feed.sourceActivity', { name: entry.sourceActivity.name })}</p>}
          <p className="subtitle" style={{ marginBottom: 0 }}>
            {new Date(entry.createdAt).toLocaleString()}
          </p>
          {entry.proofImageUrl && (
            <a href={entry.proofImageUrl} target="_blank" rel="noreferrer">
              <img src={entry.proofImageUrl} alt={t('feed.proof') as string} style={{ maxWidth: 200, borderRadius: 8, marginTop: 8 }} />
            </a>
          )}
        </div>
      ))}

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
