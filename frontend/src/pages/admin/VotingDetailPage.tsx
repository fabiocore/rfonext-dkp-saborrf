import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import {
  closeVotingTopic,
  deleteVotingTopicDraft,
  fetchVotingTopicForStaff,
  hideVotingMessage,
  isGmLevel,
  publishVotingTopic,
  unhideVotingMessage,
} from '../../api/client';
import { TableScroll } from '../../components/TableScroll';

const STATUS_LABEL: Record<string, string> = { DRAFT: 'Rascunho', OPEN: 'Aberta', CLOSED: 'Encerrada' };

export function VotingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const gmLevel = isGmLevel(user?.role);
  const queryClient = useQueryClient();
  const [closeReason, setCloseReason] = useState('');

  const topicQuery = useQuery({
    queryKey: ['voting-topic-staff', id],
    queryFn: () => fetchVotingTopicForStaff(id!),
    enabled: !!id,
    refetchInterval: 5000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['voting-topic-staff', id] });

  const publishMutation = useMutation({ mutationFn: () => publishVotingTopic(id!), onSuccess: invalidate });
  const closeMutation = useMutation({
    mutationFn: () => closeVotingTopic(id!, closeReason),
    onSuccess: () => {
      setCloseReason('');
      invalidate();
    },
  });
  const deleteMutation = useMutation({
    mutationFn: () => deleteVotingTopicDraft(id!),
    onSuccess: () => navigate('/admin/voting'),
  });
  const hideMutation = useMutation({ mutationFn: (characterId: string) => hideVotingMessage(id!, characterId), onSuccess: invalidate });
  const unhideMutation = useMutation({
    mutationFn: (characterId: string) => unhideVotingMessage(id!, characterId),
    onSuccess: invalidate,
  });

  const topic = topicQuery.data;
  if (!topic) {
    return (
      <section>
        <p>Carregando...</p>
      </section>
    );
  }

  return (
    <section>
      <p>
        <Link to="/admin/voting">← Votação</Link>
      </p>
      <h2>{topic.title}</h2>
      <p className="subtitle" style={{ whiteSpace: 'pre-wrap' }}>
        {topic.description}
      </p>
      <p>
        Status: <strong>{STATUS_LABEL[topic.status] ?? topic.status}</strong> · Tipo:{' '}
        {topic.selectionType === 'SINGLE' ? 'Única' : 'Múltipla'} · {topic.votes.length} voto(s)
        {topic.closeReason && ` · motivo do encerramento: ${topic.closeReason}`}
      </p>

      {gmLevel && topic.status === 'DRAFT' && (
        <p>
          <button type="button" onClick={() => publishMutation.mutate()} disabled={publishMutation.isPending}>
            Publicar
          </button>{' '}
          <button
            type="button"
            onClick={() => {
              if (confirm('Apagar esse rascunho? Não dá pra desfazer.')) deleteMutation.mutate();
            }}
          >
            Apagar rascunho
          </button>
          {publishMutation.isError && (
            <span className="form-error"> {(publishMutation.error as any)?.response?.data?.message}</span>
          )}
        </p>
      )}

      {gmLevel && topic.status === 'OPEN' && (
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            closeMutation.mutate();
          }}
        >
          <input
            value={closeReason}
            onChange={(e) => setCloseReason(e.target.value)}
            placeholder="Motivo do encerramento"
          />
          <button type="submit" disabled={!closeReason.trim() || closeMutation.isPending}>
            Encerrar votação
          </button>
        </form>
      )}

      <h3>Opções</h3>
      <ul>
        {topic.options.map((o) => (
          <li key={o.id}>{o.label}</li>
        ))}
      </ul>

      <h3>Votos</h3>
      <TableScroll>
        <table className="data-table">
          <thead>
            <tr>
              <th>Personagem</th>
              <th>Nível</th>
              <th>Votou em</th>
              <th>Mensagem</th>
              {gmLevel && <th></th>}
            </tr>
          </thead>
          <tbody>
            {topic.votes.map((v) => (
              <tr key={v.characterId}>
                <td>{v.gameName}</td>
                <td>{v.level ?? '-'}</td>
                <td>{v.optionLabels.join(', ')}</td>
                <td>
                  {v.message ? (
                    <>
                      {v.message}
                      {v.messageHidden && <span className="subtitle"> (oculta do público)</span>}
                    </>
                  ) : v.messageHidden ? (
                    <em className="subtitle">oculta</em>
                  ) : (
                    '—'
                  )}
                </td>
                {gmLevel && (
                  <td>
                    {v.message && !v.messageHidden && (
                      <button type="button" onClick={() => hideMutation.mutate(v.characterId)}>
                        Ocultar mensagem
                      </button>
                    )}
                    {v.messageHidden && (
                      <button type="button" onClick={() => unhideMutation.mutate(v.characterId)}>
                        Reexibir mensagem
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {topic.votes.length === 0 && (
              <tr>
                <td colSpan={gmLevel ? 5 : 4}>Ninguém votou ainda.</td>
              </tr>
            )}
          </tbody>
        </table>
      </TableScroll>
    </section>
  );
}
