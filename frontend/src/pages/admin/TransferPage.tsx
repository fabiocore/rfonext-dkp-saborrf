import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchCharacters, fetchGuildSettings, recordTransfer } from '../../api/client';
import { ImageUploadInput } from '../../components/ImageUploadInput';

export function TransferPage() {
  const queryClient = useQueryClient();
  const charactersQuery = useQuery({ queryKey: ['characters'], queryFn: fetchCharacters });
  const settingsQuery = useQuery({ queryKey: ['guild-settings'], queryFn: fetchGuildSettings });
  const currencyName = settingsQuery.data?.currencyName ?? 'BRC';
  const currencyAbbr = settingsQuery.data?.currencyAbbr ?? 'BRC';
  const principals = (charactersQuery.data ?? []).filter((c) => c.status === 'PRINCIPAL' && c.membershipStatus === 'ACTIVE');

  const [fromCharacterId, setFromCharacterId] = useState('');
  const [toCharacterId, setToCharacterId] = useState('');
  const [amount, setAmount] = useState(0);
  const [reasonText, setReasonText] = useState('');
  const [proofImageUrl, setProofImageUrl] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fromCharacter = principals.find((c) => c.id === fromCharacterId);
  const toCharacter = principals.find((c) => c.id === toCharacterId);
  const insufficientBalance = !!fromCharacter && amount > fromCharacter.balance;

  const mutation = useMutation({
    mutationFn: () =>
      recordTransfer({ fromCharacterId, toCharacterId, amount, proofImageUrl: proofImageUrl!, reasonText }),
    onSuccess: () => {
      setSuccess('Transferência registrada!');
      setError(null);
      setFromCharacterId('');
      setToCharacterId('');
      setAmount(0);
      setReasonText('');
      setProofImageUrl(null);
      queryClient.invalidateQueries({ queryKey: ['characters'] });
      queryClient.invalidateQueries({ queryKey: ['balances'] });
      queryClient.invalidateQueries({ queryKey: ['public-feed'] });
    },
    onError: (err: any) => setError(err?.response?.data?.message ?? 'Falha ao registrar transferência.'),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSuccess(null);
    setError(null);
    if (!fromCharacterId || !toCharacterId || !proofImageUrl || amount <= 0) return;
    if (fromCharacterId === toCharacterId) {
      setError('Origem e destino precisam ser personagens diferentes.');
      return;
    }
    if (insufficientBalance) {
      setError('Saldo insuficiente pra essa transferência.');
      return;
    }
    mutation.mutate();
  }

  return (
    <section>
      <h2>Transferência entre Membros</h2>
      <p className="subtitle">Movimenta {currencyName} entre dois Principais — sempre com print, sempre pública.</p>

      <form className="settings-form" onSubmit={handleSubmit}>
        <label>
          De
          <select value={fromCharacterId} onChange={(e) => setFromCharacterId(e.target.value)} required>
            <option value="">Selecione</option>
            {principals.map((c) => (
              <option key={c.id} value={c.id}>
                {c.gameName}
              </option>
            ))}
          </select>
        </label>
        {fromCharacter && (
          <p className="subtitle" style={{ marginBottom: 0 }}>
            Saldo de {fromCharacter.gameName}: <strong>{fromCharacter.balance} {currencyAbbr}</strong>
            {amount > 0 && (
              <>
                {' '}
                — após a transferência: <strong>{fromCharacter.balance - amount} {currencyAbbr}</strong>
              </>
            )}
          </p>
        )}

        <label>
          Para
          <select value={toCharacterId} onChange={(e) => setToCharacterId(e.target.value)} required>
            <option value="">Selecione</option>
            {principals.map((c) => (
              <option key={c.id} value={c.id}>
                {c.gameName}
              </option>
            ))}
          </select>
        </label>
        {toCharacter && (
          <p className="subtitle" style={{ marginBottom: 0 }}>
            Saldo de {toCharacter.gameName}: <strong>{toCharacter.balance} {currencyAbbr}</strong>
            {amount > 0 && (
              <>
                {' '}
                — após a transferência: <strong>{toCharacter.balance + amount} {currencyAbbr}</strong>
              </>
            )}
          </p>
        )}

        <label>
          Valor
          <input type="number" min={1} value={amount} onChange={(e) => setAmount(Number(e.target.value))} required />
        </label>
        {insufficientBalance && (
          <p className="form-error">
            {fromCharacter?.gameName} só tem {fromCharacter?.balance} {currencyAbbr} disponível.
          </p>
        )}

        <label>
          Motivo (opcional)
          <input value={reasonText} onChange={(e) => setReasonText(e.target.value)} placeholder="Ex: compra, agradecimento..." />
        </label>
        <label>
          Print de comprovação
          <ImageUploadInput value={proofImageUrl} onChange={setProofImageUrl} required />
        </label>

        {error && <p className="form-error">{error}</p>}
        {success && <p className="form-success">{success}</p>}

        <button type="submit" disabled={mutation.isPending || !proofImageUrl || insufficientBalance}>
          Registrar transferência
        </button>
      </form>
    </section>
  );
}
