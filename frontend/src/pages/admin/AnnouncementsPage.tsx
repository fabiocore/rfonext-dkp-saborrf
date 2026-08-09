import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createAnnouncement,
  deleteAnnouncement,
  fetchAnnouncementsStaff,
  updateAnnouncement,
  type Announcement,
} from '../../api/client';

const MAX_ANNOUNCEMENTS = 2;

function AnnouncementRow({ announcement }: { announcement: Announcement }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(announcement.title);
  const [body, setBody] = useState(announcement.body);

  const saveMutation = useMutation({
    mutationFn: () => updateAnnouncement(announcement.id, { title, body }),
    onSuccess: () => {
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ['announcements-staff'] });
      queryClient.invalidateQueries({ queryKey: ['public-announcements'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteAnnouncement(announcement.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements-staff'] });
      queryClient.invalidateQueries({ queryKey: ['public-announcements'] });
    },
  });

  if (editing) {
    return (
      <div className="auction-item-card">
        <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: '100%', marginBottom: 6 }} />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} style={{ width: '100%' }} />
        <div style={{ marginTop: 8 }}>
          <button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            Salvar
          </button>{' '}
          <button type="button" onClick={() => setEditing(false)}>
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auction-item-card">
      <h3>{announcement.title}</h3>
      <p style={{ whiteSpace: 'pre-wrap' }}>{announcement.body}</p>
      <p className="subtitle" style={{ marginBottom: 8 }}>
        {new Date(announcement.createdAt).toLocaleString('pt-BR')}
      </p>
      <button type="button" onClick={() => setEditing(true)}>
        Editar
      </button>{' '}
      <button type="button" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
        Remover
      </button>
    </div>
  );
}

function CreateAnnouncementForm() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => createAnnouncement(title, body),
    onSuccess: () => {
      setTitle('');
      setBody('');
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['announcements-staff'] });
      queryClient.invalidateQueries({ queryKey: ['public-announcements'] });
    },
    onError: (err: any) => setError(err?.response?.data?.message ?? 'Falha ao publicar aviso.'),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    mutation.mutate();
  }

  return (
    <form className="settings-form" onSubmit={handleSubmit} style={{ marginBottom: 24 }}>
      <label>
        Título
        <input value={title} onChange={(e) => setTitle(e.target.value)} required />
      </label>
      <label>
        Mensagem
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} required />
      </label>
      {error && <p className="form-error">{error}</p>}
      <button type="submit" disabled={mutation.isPending}>
        Publicar aviso
      </button>
    </form>
  );
}

export function AnnouncementsPage() {
  const announcementsQuery = useQuery({ queryKey: ['announcements-staff'], queryFn: fetchAnnouncementsStaff });
  const count = announcementsQuery.data?.length ?? 0;
  const atLimit = count >= MAX_ANNOUNCEMENTS;

  return (
    <section>
      <h2>Mural de Avisos</h2>
      <p className="subtitle">
        Aparece fixo na home pública — use pra chamada de eventos, mudanças de regra, pedidos etc. Máximo de{' '}
        {MAX_ANNOUNCEMENTS} avisos ao mesmo tempo ({count}/{MAX_ANNOUNCEMENTS} agora). Fica até você editar ou
        remover.
      </p>

      {atLimit ? (
        <p className="form-error" style={{ marginBottom: 24 }}>
          Limite de {MAX_ANNOUNCEMENTS} avisos atingido. Edite ou remova um abaixo pra publicar outro.
        </p>
      ) : (
        <CreateAnnouncementForm />
      )}

      {announcementsQuery.data?.map((a) => (
        <AnnouncementRow key={a.id} announcement={a} />
      ))}
    </section>
  );
}
