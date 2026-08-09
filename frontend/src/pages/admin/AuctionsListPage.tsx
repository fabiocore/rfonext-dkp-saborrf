import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createAuctionDraft, fetchAuctionsStaff } from '../../api/client';

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Rascunho',
  PENDING_APPROVAL: 'Aguardando aprovação',
  OPEN: 'Aberto',
  CLOSED: 'Encerrado',
};

export function AuctionsListPage() {
  const queryClient = useQueryClient();
  const auctionsQuery = useQuery({ queryKey: ['auctions-staff'], queryFn: fetchAuctionsStaff });
  const [title, setTitle] = useState('');

  const mutation = useMutation({
    mutationFn: () => createAuctionDraft(title),
    onSuccess: () => {
      setTitle('');
      queryClient.invalidateQueries({ queryKey: ['auctions-staff'] });
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    mutation.mutate();
  }

  return (
    <section>
      <h2>Leilões</h2>
      <p className="subtitle">Um leilão = um evento do jogo, com título e vários itens.</p>

      <form className="inline-form" onSubmit={handleSubmit}>
        <input placeholder="Título do leilão (ex: Raid de Guilda 08/08)" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <button type="submit" disabled={mutation.isPending}>
          Criar rascunho
        </button>
      </form>

      <table className="data-table">
        <thead>
          <tr>
            <th>Título</th>
            <th>Status</th>
            <th>Itens</th>
            <th>Participantes</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {auctionsQuery.data?.map((auction) => (
            <tr key={auction.id}>
              <td>{auction.title}</td>
              <td>{STATUS_LABEL[auction.status] ?? auction.status}</td>
              <td>{auction.items.length}</td>
              <td>{auction.participants.length}</td>
              <td>
                <Link to={`/admin/auctions/${auction.id}`}>Abrir</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
