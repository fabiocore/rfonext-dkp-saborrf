import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { approveLevelRequest, fetchLevelRequests, rejectLevelRequest } from '../../api/client';

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Aguardando revisão',
  APPROVED: 'Aprovado',
  REJECTED: 'Rejeitado',
};

export function LevelRequestsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | ''>('PENDING');

  const requestsQuery = useQuery({
    queryKey: ['level-requests', statusFilter],
    queryFn: () => fetchLevelRequests(statusFilter || undefined),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => approveLevelRequest(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['level-requests'] }),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectLevelRequest(id, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['level-requests'] }),
  });

  function handleReject(id: string, gameName: string) {
    const reason = prompt(`Motivo pra rejeitar a solicitação de "${gameName}" (obrigatório):`);
    if (!reason?.trim()) return;
    rejectMutation.mutate({ id, reason: reason.trim() });
  }

  return (
    <section>
      <h2>Solicitações de Nível</h2>
      <p className="subtitle">
        Pedidos de atualização de nível enviados pelos próprios membros via perfil (sempre com print de
        comprovação) — nunca aplicam sozinhos, precisam da sua aprovação ou do conselho, porque nível decide
        elegibilidade em itens de leilão com Proteção.
      </p>

      <label>
        Status{' '}
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
          <option value="PENDING">Aguardando revisão</option>
          <option value="APPROVED">Aprovados</option>
          <option value="REJECTED">Rejeitados</option>
          <option value="">Todos</option>
        </select>
      </label>

      {requestsQuery.data?.length === 0 && <p>Nenhuma solicitação aqui.</p>}

      <table className="data-table">
        <thead>
          <tr>
            <th>Personagem</th>
            <th>Nível atual</th>
            <th>Nível pedido</th>
            <th>Print</th>
            <th>Data</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {requestsQuery.data?.map((r) => (
            <tr key={r.id}>
              <td>{r.character?.gameName}</td>
              <td>{r.character?.level ?? '-'}</td>
              <td>
                <strong>{r.requestedLevel}</strong>
              </td>
              <td>
                <a href={r.proofImageUrl} target="_blank" rel="noreferrer">
                  <img src={r.proofImageUrl} alt="Print" style={{ maxWidth: 80, borderRadius: 4 }} />
                </a>
              </td>
              <td>{new Date(r.createdAt).toLocaleString('pt-BR')}</td>
              <td>
                {STATUS_LABEL[r.status]}
                {r.status === 'REJECTED' && r.rejectReason && <div className="subtitle">motivo: {r.rejectReason}</div>}
              </td>
              <td>
                {r.status === 'PENDING' && (
                  <>
                    <button type="button" onClick={() => approveMutation.mutate(r.id)} disabled={approveMutation.isPending}>
                      Aprovar
                    </button>{' '}
                    <button
                      type="button"
                      onClick={() => handleReject(r.id, r.character?.gameName ?? '')}
                      disabled={rejectMutation.isPending}
                    >
                      Rejeitar
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
