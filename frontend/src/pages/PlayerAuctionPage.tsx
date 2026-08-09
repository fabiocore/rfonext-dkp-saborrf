import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import {
  fetchGuildSettings,
  fetchPlayerAuctionView,
  placePlayerBid,
  withdrawPlayerBid,
  type PlayerAuctionItemView,
} from '../api/client';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

function ItemCard({
  code,
  item,
  disabled,
  currencyAbbr,
}: {
  code: string;
  item: PlayerAuctionItemView;
  disabled: boolean;
  currencyAbbr: string;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const minNext = Math.max(item.leadingAmount, item.protection?.minBid ?? 0) + 1;
  const [amount, setAmount] = useState(minNext);
  const [error, setError] = useState<string | null>(null);

  const bidMutation = useMutation({
    mutationFn: () => placePlayerBid(code, item.id, amount),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['player-auction', code] });
    },
    onError: (err: any) => setError(err?.response?.data?.message ?? (t('player.genericError') as string)),
  });

  const withdrawMutation = useMutation({
    mutationFn: () => withdrawPlayerBid(code, item.id),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['player-auction', code] });
    },
    onError: (err: any) => setError(err?.response?.data?.message ?? (t('player.genericError') as string)),
  });

  const resolved = item.resolutionStatus !== 'PENDING';
  const canWithdraw = item.ownAmount > 0 && !item.withdrawn && !resolved && !disabled;

  return (
    <div className="auction-item-card">
      {item.imageUrl && (
        <img src={item.imageUrl} alt={item.name} style={{ maxWidth: 200, borderRadius: 8, marginBottom: 8 }} />
      )}
      <h3>
        {item.name}
        {item.protection && <span className="badge">{item.protection.name}</span>}
      </h3>
      {item.protection && <p className="subtitle">{item.protection.description}</p>}

      {item.resolutionStatus === 'CANCELLED' && (
        <p className="form-error">{t('player.itemCancelled', { reason: item.cancelReason })}</p>
      )}
      {item.resolutionStatus === 'UNCLAIMED' && <p className="form-error">{t('auctions.unclaimed')}</p>}
      {item.resolutionStatus === 'WON' && (
        <p className={item.won ? 'form-success' : 'subtitle'}>
          {item.won ? t('player.youWon') : t('player.itemWonByOther')}
        </p>
      )}
      {item.withdrawn && <p className="subtitle">{t('player.youWithdrew')}</p>}

      <p>
        {t('player.currentBid')}: <strong>{item.leadingAmount || '—'}</strong> · {t('player.yourBid')}:{' '}
        {item.ownAmount || '—'} · {t('player.bidsCount', { count: item.bidCount })}
      </p>

      {!item.eligible && <p className="form-error">{t('player.notEligible')}</p>}

      {item.eligible && !disabled && !resolved && !item.withdrawn && (
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            bidMutation.mutate();
          }}
        >
          <input
            type="number"
            min={minNext}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            style={{ width: 100 }}
          />
          <span>{currencyAbbr}</span>
          <button type="submit" disabled={bidMutation.isPending}>
            {t('player.placeBid')}
          </button>
        </form>
      )}

      {canWithdraw && (
        <button
          type="button"
          onClick={() => {
            if (confirm(t('player.withdrawConfirm') as string)) withdrawMutation.mutate();
          }}
          disabled={withdrawMutation.isPending}
        >
          {t('player.withdraw')}
        </button>
      )}

      {error && <p className="form-error">{error}</p>}
    </div>
  );
}

export function PlayerAuctionPage() {
  const { t } = useTranslation();
  const { code } = useParams<{ code: string }>();
  const viewQuery = useQuery({
    queryKey: ['player-auction', code],
    queryFn: () => fetchPlayerAuctionView(code!),
    enabled: !!code,
    refetchInterval: 5000,
  });
  const settingsQuery = useQuery({ queryKey: ['guild-settings'], queryFn: fetchGuildSettings });
  const currencyAbbr = settingsQuery.data?.currencyAbbr ?? '';

  if (viewQuery.isLoading) return <div className="app-shell">{t('player.loading')}</div>;
  if (viewQuery.isError || !viewQuery.data) {
    return (
      <div className="app-shell">
        <header className="app-header">
          <Link to="/" className="guild-name" style={{ textDecoration: 'none', color: 'inherit' }}>
            {t('player.backHome')}
          </Link>
          <LanguageSwitcher />
        </header>
        <p className="form-error">{t('player.invalidCode')}</p>
      </div>
    );
  }

  const view = viewQuery.data;
  const reserved = view.walletBalance - view.availableBalance;

  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="guild-name">{view.auction.title}</span>
        <LanguageSwitcher />
      </header>
      <p>
        <Link to="/">{t('player.backHome')}</Link>
      </p>
      <main>
        <p>
          {view.character.gameName} {view.character.level ? t('player.level', { level: view.character.level }) : ''}
        </p>
        <p>
          {t('player.balance')}: <strong>{t('common.amount', { amount: view.walletBalance, currencyAbbr })}</strong>
          {reserved > 0 && (
            <>
              {' '}
              · {t('player.reserved')}: <strong>{t('common.amount', { amount: reserved, currencyAbbr })}</strong>
            </>
          )}{' '}
          · {t('player.available')}: <strong>{t('common.amount', { amount: view.availableBalance, currencyAbbr })}</strong>
        </p>

        {!view.isActive && (
          <p className="form-error">
            {t('player.closed')} <Link to={`/leiloes/${view.auction.id}`}>{t('player.viewResult')}</Link>
          </p>
        )}

        {view.items.map((item) => (
          <ItemCard key={item.id} code={code!} item={item} disabled={!view.isActive} currencyAbbr={currencyAbbr} />
        ))}
      </main>
    </div>
  );
}
