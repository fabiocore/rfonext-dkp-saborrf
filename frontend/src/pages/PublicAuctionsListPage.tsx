import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { fetchPublicAuctions } from '../api/client';

function CodeEntryForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [code, setCode] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    navigate(`/oferta/${trimmed}`);
  }

  return (
    <div className="auction-item-card" style={{ marginBottom: 16 }}>
      <h3 style={{ marginTop: 0 }}>{t('codeEntry.title')}</h3>
      <p className="subtitle">{t('codeEntry.subtitle')}</p>
      <form className="inline-form" onSubmit={handleSubmit}>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder={t('codeEntry.placeholder') as string}
          style={{ textTransform: 'uppercase', letterSpacing: '0.1em' }}
        />
        <button type="submit" disabled={!code.trim()}>
          {t('codeEntry.submit')}
        </button>
      </form>
    </div>
  );
}

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

      <CodeEntryForm />

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
