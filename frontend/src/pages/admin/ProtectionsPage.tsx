import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createProtection, fetchGuildSettings, fetchProtections, updateProtection, type Protection } from '../../api/client';

function ProtectionRow({ protection, currencyAbbr }: { protection: Protection; currencyAbbr: string }) {
  const queryClient = useQueryClient();
  const [description, setDescription] = useState(protection.description);
  const [minBid, setMinBid] = useState(protection.minBid);
  const [minLevel, setMinLevel] = useState(protection.minLevel);

  const mutation = useMutation({
    mutationFn: () => updateProtection(protection.id, { description, minBid, minLevel }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['protections'] }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: () => updateProtection(protection.id, { isActive: !protection.isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['protections'] }),
  });

  const dirty =
    description !== protection.description || minBid !== protection.minBid || minLevel !== protection.minLevel;

  return (
    <tr className={protection.isActive ? '' : 'inactive'}>
      <td>{protection.name}</td>
      <td>
        <input value={description} onChange={(e) => setDescription(e.target.value)} style={{ width: '100%' }} />
      </td>
      <td>
        <input type="number" min={0} value={minBid} onChange={(e) => setMinBid(Number(e.target.value))} style={{ width: 80 }} />
      </td>
      <td>
        <input
          type="number"
          min={0}
          value={minLevel}
          onChange={(e) => setMinLevel(Number(e.target.value))}
          style={{ width: 70 }}
        />
      </td>
      <td>
        <span className={protection.isActive ? 'badge badge-yes' : 'badge badge-no'}>
          {protection.isActive ? 'Ativa' : 'Desativada'}
        </span>
      </td>
      <td>
        <button type="button" disabled={!dirty || mutation.isPending} onClick={() => mutation.mutate()}>
          Salvar
        </button>{' '}
        <button type="button" onClick={() => toggleActiveMutation.mutate()} disabled={toggleActiveMutation.isPending}>
          {protection.isActive ? 'Desativar' : 'Reativar'}
        </button>
      </td>
    </tr>
  );
}

function CreateProtectionForm({ currencyAbbr }: { currencyAbbr: string }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [minBid, setMinBid] = useState(0);
  const [minLevel, setMinLevel] = useState(0);

  const mutation = useMutation({
    mutationFn: () => createProtection({ name, description, minBid, minLevel }),
    onSuccess: () => {
      setName('');
      setDescription('');
      setMinBid(0);
      setMinLevel(0);
      queryClient.invalidateQueries({ queryKey: ['protections'] });
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    mutation.mutate();
  }

  return (
    <form className="settings-form" onSubmit={handleSubmit}>
      <label>
        Nome
        <input placeholder="ex: PCE1" value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label>
        Descrição (explicando a regra por extenso, pra quem cadastra um item não precisar perguntar)
        <input
          placeholder="ex: Elite Carrie T1 lvl 57+"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      <label>
        Lance mínimo ({currencyAbbr}) — valor mais baixo que dá pra ofertar num item com essa proteção
        <input type="number" min={0} value={minBid} onChange={(e) => setMinBid(Number(e.target.value))} style={{ width: 90 }} />
      </label>
      <label>
        Nível mínimo do personagem — quem tem nível abaixo disso não consegue ofertar em item com essa proteção
        <input
          type="number"
          min={0}
          value={minLevel}
          onChange={(e) => setMinLevel(Number(e.target.value))}
          style={{ width: 90 }}
        />
      </label>
      <button type="submit" disabled={mutation.isPending}>
        Criar proteção
      </button>
    </form>
  );
}

export function ProtectionsPage() {
  const protectionsQuery = useQuery({ queryKey: ['protections'], queryFn: fetchProtections });
  const settingsQuery = useQuery({ queryKey: ['guild-settings'], queryFn: fetchGuildSettings });
  const currencyAbbr = settingsQuery.data?.currencyAbbr ?? 'BRC';

  return (
    <section>
      <h2>Proteções (PCE)</h2>
      <p className="subtitle">
        Define quem pode ofertar em cada item de leilão: lance mínimo e nível mínimo do personagem. Não dá pra
        apagar uma proteção de verdade — leilões antigos podem ter itens que usam ela, e apagar quebraria esse
        histórico. Em vez disso, <strong>desative</strong> a que não quer mais usar: ela some da lista de opções na
        hora de cadastrar um item novo, mas continua existindo (e reaparece aqui, esmaecida) pra manter o histórico
        certo. Dá pra reativar a qualquer momento.
      </p>

      <CreateProtectionForm currencyAbbr={currencyAbbr} />

      <table className="data-table">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Descrição</th>
            <th>Lance mín.</th>
            <th>Nível mín.</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {protectionsQuery.data?.map((protection) => (
            <ProtectionRow key={protection.id} protection={protection} currencyAbbr={currencyAbbr} />
          ))}
        </tbody>
      </table>
    </section>
  );
}
