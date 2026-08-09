import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchCharacters, fetchGuildSettings, recordManualAdjustment } from '../../api/client';
import { ImageUploadInput } from '../../components/ImageUploadInput';

export function ManualAdjustmentPage() {
  const queryClient = useQueryClient();
  const charactersQuery = useQuery({ queryKey: ['characters'], queryFn: fetchCharacters });
  const settingsQuery = useQuery({ queryKey: ['guild-settings'], queryFn: fetchGuildSettings });
  const currencyName = settingsQuery.data?.currencyName ?? 'BRC';
  const principals = (charactersQuery.data ?? []).filter((c) => c.status === 'PRINCIPAL' && c.membershipStatus === 'ACTIVE');

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [amount, setAmount] = useState(0);
  const [reasonText, setReasonText] = useState('');
  const [proofImageUrl, setProofImageUrl] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      recordManualAdjustment({ characterIds: Array.from(selectedIds), amount, reasonText, proofImageUrl: proofImageUrl ?? undefined }),
    onSuccess: () => {
      setSuccess(`Emissão registrada pra ${selectedIds.size} personagem(ns)!`);
      setError(null);
      setSelectedIds(new Set());
      setAmount(0);
      setReasonText('');
      setProofImageUrl(null);
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['public-feed'] });
    },
    onError: (err: any) => setError(err?.response?.data?.message ?? 'Falha ao registrar emissão.'),
  });

  function toggleCharacter(characterId: string) {
    const next = new Set(selectedIds);
    if (next.has(characterId)) next.delete(characterId);
    else next.add(characterId);
    setSelectedIds(next);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSuccess(null);
    setError(null);
    if (selectedIds.size === 0 || amount === 0 || !reasonText.trim()) return;
    mutation.mutate();
  }

  return (
    <section>
      <h2>Emissão Manual (GM)</h2>
      <p className="subtitle">
        Cria (positivo) ou queima (negativo) {currencyName} pra um ou vários membros de uma vez, todos com o mesmo
        valor. Motivo obrigatório, print opcional, sempre público. Exclusivo do GM.
      </p>

      <form className="settings-form" onSubmit={handleSubmit}>
        <label>Personagens</label>
        <div>
          <button type="button" onClick={() => setSelectedIds(new Set(principals.map((c) => c.id)))}>
            Selecionar todos
          </button>{' '}
          <button type="button" onClick={() => setSelectedIds(new Set())}>
            Desmarcar todos
          </button>
        </div>
        <div className="checkbox-grid">
          {principals.map((c) => (
            <label key={c.id}>
              <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleCharacter(c.id)} />
              {c.gameName}
            </label>
          ))}
        </div>
        <label>
          Valor (negativo pra queimar)
          <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} required />
        </label>
        <label>
          Motivo (obrigatório)
          <input value={reasonText} onChange={(e) => setReasonText(e.target.value)} required />
        </label>
        <label>
          Print de comprovação (opcional)
          <ImageUploadInput value={proofImageUrl} onChange={setProofImageUrl} />
        </label>

        {error && <p className="form-error">{error}</p>}
        {success && <p className="form-success">{success}</p>}

        <button type="submit" disabled={mutation.isPending || selectedIds.size === 0}>
          Registrar emissão
        </button>
      </form>
    </section>
  );
}
