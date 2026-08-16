import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createVotingTopic, fetchVotingTopicsForStaff, isGmLevel, type VotingSelectionType } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { TableScroll } from '../../components/TableScroll';

const STATUS_LABEL: Record<string, string> = { DRAFT: 'Rascunho', OPEN: 'Aberta', CLOSED: 'Encerrada' };

function CreateTopicForm() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectionType, setSelectionType] = useState<VotingSelectionType>('SINGLE');
  const [options, setOptions] = useState(['', '']);
  const [scheduledEndAt, setScheduledEndAt] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      createVotingTopic({
        title,
        description,
        selectionType,
        options: options.map((o) => o.trim()).filter(Boolean),
        scheduledEndAt: scheduledEndAt ? new Date(scheduledEndAt).toISOString() : null,
      }),
    onSuccess: () => {
      setTitle('');
      setDescription('');
      setSelectionType('SINGLE');
      setOptions(['', '']);
      setScheduledEndAt('');
      queryClient.invalidateQueries({ queryKey: ['voting-topics'] });
    },
  });

  function updateOption(i: number, value: string) {
    setOptions((prev) => prev.map((o, idx) => (idx === i ? value : o)));
  }
  function addOption() {
    setOptions((prev) => [...prev, '']);
  }
  function removeOption(i: number) {
    setOptions((prev) => prev.filter((_, idx) => idx !== i));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    mutation.mutate();
  }

  return (
    <form className="settings-form" onSubmit={handleSubmit}>
      <label>
        Título
        <input value={title} onChange={(e) => setTitle(e.target.value)} required />
      </label>
      <label>
        Descrição
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} required />
      </label>
      <label>
        Tipo de seleção
        <select value={selectionType} onChange={(e) => setSelectionType(e.target.value as VotingSelectionType)}>
          <option value="SINGLE">Única (escolhe 1)</option>
          <option value="MULTIPLE">Múltipla (escolhe 1 ou mais)</option>
        </select>
      </label>
      <label>Opções</label>
      {options.map((o, i) => (
        <div key={i} className="inline-form">
          <input value={o} onChange={(e) => updateOption(i, e.target.value)} placeholder={`Opção ${i + 1}`} />
          {options.length > 2 && (
            <button type="button" onClick={() => removeOption(i)}>
              Remover
            </button>
          )}
        </div>
      ))}
      <button type="button" onClick={addOption}>
        Adicionar opção
      </button>
      <label>
        Encerrar automaticamente em (opcional)
        <input type="datetime-local" value={scheduledEndAt} onChange={(e) => setScheduledEndAt(e.target.value)} />
      </label>
      <button type="submit" disabled={mutation.isPending}>
        Criar votação (rascunho)
      </button>
      {mutation.isError && (
        <p className="form-error">{(mutation.error as any)?.response?.data?.message ?? 'Erro ao criar.'}</p>
      )}
    </form>
  );
}

export function VotingListPage() {
  const { user } = useAuth();
  const gmLevel = isGmLevel(user?.role);
  const topicsQuery = useQuery({ queryKey: ['voting-topics'], queryFn: fetchVotingTopicsForStaff });

  return (
    <section>
      <h2>Votação</h2>
      <p className="subtitle">
        Só GM/Vice-GM criam e publicam votações — sem aprovação dupla do Conselho. Só 1 votação pode ficar aberta por
        vez. O jogador vota com o próprio código de perfil (o mesmo do <code>/perfil</code>).
      </p>

      {gmLevel && <CreateTopicForm />}

      <TableScroll>
        <table className="data-table">
          <thead>
            <tr>
              <th>Título</th>
              <th>Status</th>
              <th>Tipo</th>
              <th>Votos</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {topicsQuery.data?.map((topic) => (
              <tr key={topic.id}>
                <td>{topic.title}</td>
                <td>{STATUS_LABEL[topic.status] ?? topic.status}</td>
                <td>{topic.selectionType === 'SINGLE' ? 'Única' : 'Múltipla'}</td>
                <td>{topic._count?.votes ?? 0}</td>
                <td>
                  <Link to={`/admin/voting/${topic.id}`}>Abrir</Link>
                </td>
              </tr>
            ))}
            {topicsQuery.data?.length === 0 && (
              <tr>
                <td colSpan={5}>Nenhuma votação criada ainda.</td>
              </tr>
            )}
          </tbody>
        </table>
      </TableScroll>
    </section>
  );
}
