import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchPublicVotingTopic, fetchVotingResults, submitVote, type VotingResults } from '../api/client';

function ResultsBlock({ results }: { results: VotingResults }) {
  const { t } = useTranslation();
  const totalVotes = results.voters.length;

  return (
    <>
      <h2>{t('voting.resultsTitle')}</h2>
      <TallyBars results={results} totalVotes={totalVotes} />

      <h3>{t('voting.whoVotedTitle')}</h3>
      {results.voters.length === 0 && <p className="subtitle">{t('voting.noVotesYet')}</p>}
      {results.voters.map((v) => (
        <div key={v.characterId} className="auction-item-card">
          <h3 style={{ marginTop: 0 }}>
            {v.gameName} {v.level ? t('player.level', { level: v.level }) : ''}
          </h3>
          <p>
            <strong>{v.optionLabels.join(', ')}</strong>
          </p>
          {v.message && <p style={{ whiteSpace: 'pre-wrap' }}>{v.message}</p>}
        </div>
      ))}
    </>
  );
}

function TallyBars({ results, totalVotes }: { results: VotingResults; totalVotes: number }) {
  return (
    <div style={{ marginBottom: 20 }}>
      {results.tally.map((t) => {
        const pct = totalVotes > 0 ? Math.round((t.count / totalVotes) * 100) : 0;
        return (
          <div key={t.optionId} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span>{t.label}</span>
              <span className="subtitle">
                {t.count} ({pct}%)
              </span>
            </div>
            <div style={{ background: 'var(--bg-elevated-2)', borderRadius: 6, height: 10, overflow: 'hidden' }}>
              <div style={{ background: 'var(--accent)', width: `${pct}%`, height: '100%' }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function VotingPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const [code, setCode] = useState('');
  const [codeSubmitted, setCodeSubmitted] = useState(false);
  const [showBallot, setShowBallot] = useState(false);
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [voteError, setVoteError] = useState<string | null>(null);

  const topicQuery = useQuery({
    queryKey: ['public-voting-topic', id],
    queryFn: () => fetchPublicVotingTopic(id!),
    enabled: !!id,
  });
  const topic = topicQuery.data;
  const isClosed = topic?.status === 'CLOSED';

  const resultsQuery = useQuery({
    queryKey: ['voting-results', id, isClosed ? 'closed' : code],
    queryFn: () => fetchVotingResults(id!, isClosed ? undefined : code),
    enabled: !!id && !!topic && (isClosed || codeSubmitted),
    retry: false,
    refetchInterval: 8000,
  });

  const voteMutation = useMutation({
    mutationFn: () => submitVote(id!, code, selectedOptionIds, message.trim() || undefined),
    onSuccess: () => {
      setVoteError(null);
      setShowBallot(false);
      queryClient.invalidateQueries({ queryKey: ['voting-results', id, code] });
    },
    onError: (err: any) => setVoteError(err?.response?.data?.message ?? (t('voting.genericError') as string)),
  });

  const statusCode = (resultsQuery.error as any)?.response?.status as number | undefined;
  const codeInvalid = codeSubmitted && statusCode === 404;
  const notVotedYet = codeSubmitted && statusCode === 403;

  useEffect(() => {
    if (topic && notVotedYet && !showBallot) {
      setSelectedOptionIds([]);
      setShowBallot(true);
    }
  }, [notVotedYet, topic, showBallot]);

  function handleCodeSubmit(e: FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setCodeSubmitted(true);
  }

  function toggleOption(optionId: string) {
    if (!topic) return;
    if (topic.selectionType === 'SINGLE') {
      setSelectedOptionIds([optionId]);
    } else {
      setSelectedOptionIds((prev) => (prev.includes(optionId) ? prev.filter((o) => o !== optionId) : [...prev, optionId]));
    }
  }

  function openBallotToChange() {
    const mine = resultsQuery.data?.myVote;
    setSelectedOptionIds(mine?.optionIds ?? []);
    setMessage(mine?.message ?? '');
    setShowBallot(true);
  }

  function handleVoteSubmit(e: FormEvent) {
    e.preventDefault();
    voteMutation.mutate();
  }

  if (topicQuery.isLoading) return <section><p>{t('common.loading')}</p></section>;
  if (topicQuery.isError || !topic) {
    return (
      <section>
        <p className="form-error">{t('voting.notFound')}</p>
      </section>
    );
  }

  const hasResults = !!resultsQuery.data;

  return (
    <section>
      <h1>{topic.title}</h1>
      <p style={{ whiteSpace: 'pre-wrap' }}>{topic.description}</p>
      {isClosed && (
        <p className="subtitle">
          {t('voting.closedLabel')}
          {topic.closeReason && ` — ${t('auctions.closeReason', { reason: topic.closeReason })}`}
        </p>
      )}

      {!isClosed && !codeSubmitted && (
        <div className="auction-item-card">
          <h3 style={{ marginTop: 0 }}>{t('voting.enterCodeTitle')}</h3>
          <p className="subtitle">{t('voting.enterCodeSubtitle')}</p>
          <form className="inline-form" onSubmit={handleCodeSubmit}>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder={t('voting.codePlaceholder') as string}
              autoFocus
              style={{ textTransform: 'uppercase', letterSpacing: '0.1em' }}
            />
            <button type="submit" disabled={!code.trim()}>
              {t('voting.enterCodeSubmit')}
            </button>
          </form>
        </div>
      )}

      {codeInvalid && <p className="form-error">{t('voting.invalidCode')}</p>}

      {hasResults && !showBallot && (
        <>
          <ResultsBlock results={resultsQuery.data!} />
          {!isClosed && (
            <button type="button" onClick={openBallotToChange}>
              {t('voting.changeVote')}
            </button>
          )}
        </>
      )}

      {!isClosed && codeSubmitted && !codeInvalid && showBallot && (
        <form className="settings-form" onSubmit={handleVoteSubmit}>
          <label>{topic.selectionType === 'SINGLE' ? t('voting.chooseOne') : t('voting.chooseMany')}</label>
          <div className="checkbox-grid">
            {topic.options.map((o) => (
              <label key={o.id}>
                <input
                  type={topic.selectionType === 'SINGLE' ? 'radio' : 'checkbox'}
                  name="voting-option"
                  checked={selectedOptionIds.includes(o.id)}
                  onChange={() => toggleOption(o.id)}
                />
                {o.label}
              </label>
            ))}
          </div>
          <label>
            {t('voting.messageLabel')}
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 280))}
              maxLength={280}
              placeholder={t('voting.messagePlaceholder') as string}
              rows={3}
            />
          </label>
          <p className="subtitle" style={{ marginTop: -8 }}>
            {t('voting.messageHint')}
          </p>
          <button type="submit" disabled={selectedOptionIds.length === 0 || voteMutation.isPending}>
            {t('voting.submitVote')}
          </button>
          {hasResults && (
            <button type="button" onClick={() => setShowBallot(false)} disabled={voteMutation.isPending}>
              {t('voting.cancelChange')}
            </button>
          )}
          {voteError && <p className="form-error">{voteError}</p>}
        </form>
      )}
    </section>
  );
}
