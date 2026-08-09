import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createCouncilUser,
  fetchCouncilUsers,
  resetCouncilPassword,
  setCouncilActive,
  type CouncilUser,
} from '../../api/client';

function RevealedPassword({ username, password, onDismiss }: { username: string; password: string; onDismiss: () => void }) {
  return (
    <div className="form-success">
      Senha gerada para <strong>{username}</strong>: <code>{password}</code> — anote agora, ela não será mostrada de
      novo. <button type="button" onClick={onDismiss}>Ok</button>
    </div>
  );
}

function CouncilRow({
  user,
  onRevealPassword,
}: {
  user: CouncilUser;
  onRevealPassword: (username: string, password: string) => void;
}) {
  const queryClient = useQueryClient();

  const resetMutation = useMutation({
    mutationFn: () => resetCouncilPassword(user.id),
    onSuccess: (result) => {
      onRevealPassword(result.user.username, result.generatedPassword);
      queryClient.invalidateQueries({ queryKey: ['council-users'] });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: () => setCouncilActive(user.id, !user.isActive),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['council-users'] }),
  });

  return (
    <tr className={user.isActive ? '' : 'inactive'}>
      <td>{user.username}</td>
      <td>{user.isActive ? 'Ativo' : 'Inativo'}</td>
      <td>{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('pt-BR') : 'Nunca'}</td>
      <td>
        <button type="button" disabled={resetMutation.isPending} onClick={() => resetMutation.mutate()}>
          Redefinir senha
        </button>{' '}
        <button type="button" disabled={toggleMutation.isPending} onClick={() => toggleMutation.mutate()}>
          {user.isActive ? 'Desativar' : 'Reativar'}
        </button>
      </td>
    </tr>
  );
}

export function CouncilUsersPage() {
  const queryClient = useQueryClient();
  const usersQuery = useQuery({ queryKey: ['council-users'], queryFn: fetchCouncilUsers });
  const [username, setUsername] = useState('');
  const [revealed, setRevealed] = useState<{ username: string; password: string } | null>(null);

  const createMutation = useMutation({
    mutationFn: () => createCouncilUser(username),
    onSuccess: (result) => {
      setRevealed({ username: result.user.username, password: result.generatedPassword });
      setUsername('');
      queryClient.invalidateQueries({ queryKey: ['council-users'] });
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!username.trim()) return;
    createMutation.mutate();
  }

  return (
    <section>
      <h2>Contas de Conselho</h2>
      <p className="subtitle">
        Só o GM cria e reseta senhas de conselho. A senha é gerada automaticamente e mostrada uma única vez.
      </p>

      {revealed && (
        <RevealedPassword username={revealed.username} password={revealed.password} onDismiss={() => setRevealed(null)} />
      )}

      <form className="inline-form" onSubmit={handleSubmit}>
        <input placeholder="Usuário do novo conselheiro" value={username} onChange={(e) => setUsername(e.target.value)} required />
        <button type="submit" disabled={createMutation.isPending}>
          Criar conta de conselho
        </button>
      </form>

      <table className="data-table">
        <thead>
          <tr>
            <th>Usuário</th>
            <th>Status</th>
            <th>Último login</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {usersQuery.data?.map((user) => (
            <CouncilRow key={user.id} user={user} onRevealPassword={(u, p) => setRevealed({ username: u, password: p })} />
          ))}
        </tbody>
      </table>
    </section>
  );
}
