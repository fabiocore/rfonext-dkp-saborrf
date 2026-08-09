import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createStaffUser,
  fetchStaffUsers,
  resetStaffPassword,
  setStaffActive,
  type StaffUser,
} from '../../api/client';

const ROLE_LABEL: Record<string, string> = { VICE_GM: 'Vice-GM', COUNCIL: 'Conselho' };

function RevealedPassword({ username, password, onDismiss }: { username: string; password: string; onDismiss: () => void }) {
  return (
    <div className="form-success">
      Senha gerada para <strong>{username}</strong>: <code>{password}</code> — anote agora, ela não será mostrada de
      novo. <button type="button" onClick={onDismiss}>Ok</button>
    </div>
  );
}

function StaffRow({
  user,
  onRevealPassword,
}: {
  user: StaffUser;
  onRevealPassword: (username: string, password: string) => void;
}) {
  const queryClient = useQueryClient();

  const resetMutation = useMutation({
    mutationFn: () => resetStaffPassword(user.id),
    onSuccess: (result) => {
      onRevealPassword(result.user.username, result.generatedPassword);
      queryClient.invalidateQueries({ queryKey: ['staff-users'] });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: () => setStaffActive(user.id, !user.isActive),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['staff-users'] }),
  });

  return (
    <tr className={user.isActive ? '' : 'inactive'}>
      <td>{user.username}</td>
      <td>{ROLE_LABEL[user.role] ?? user.role}</td>
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
  const usersQuery = useQuery({ queryKey: ['staff-users'], queryFn: fetchStaffUsers });
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<'COUNCIL' | 'VICE_GM'>('COUNCIL');
  const [revealed, setRevealed] = useState<{ username: string; password: string } | null>(null);

  const createMutation = useMutation({
    mutationFn: () => createStaffUser(username, role),
    onSuccess: (result) => {
      setRevealed({ username: result.user.username, password: result.generatedPassword });
      setUsername('');
      queryClient.invalidateQueries({ queryKey: ['staff-users'] });
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!username.trim()) return;
    createMutation.mutate();
  }

  return (
    <section>
      <h2>Equipe (Conselho e Vice-GM)</h2>
      <p className="subtitle">
        Vice-GM tem os mesmos direitos do GM em tudo. Só GM/Vice-GM cria e reseta essas senhas. A senha é gerada
        automaticamente e mostrada uma única vez. Não há limite de quantidade de contas.
      </p>

      {revealed && (
        <RevealedPassword username={revealed.username} password={revealed.password} onDismiss={() => setRevealed(null)} />
      )}

      <form className="inline-form" onSubmit={handleSubmit}>
        <input placeholder="Usuário da nova conta" value={username} onChange={(e) => setUsername(e.target.value)} required />
        <select value={role} onChange={(e) => setRole(e.target.value as 'COUNCIL' | 'VICE_GM')}>
          <option value="COUNCIL">Conselho</option>
          <option value="VICE_GM">Vice-GM</option>
        </select>
        <button type="submit" disabled={createMutation.isPending}>
          Criar conta
        </button>
      </form>

      <table className="data-table">
        <thead>
          <tr>
            <th>Usuário</th>
            <th>Papel</th>
            <th>Status</th>
            <th>Último login</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {usersQuery.data?.map((user) => (
            <StaffRow key={user.id} user={user} onRevealPassword={(u, p) => setRevealed({ username: u, password: p })} />
          ))}
        </tbody>
      </table>
    </section>
  );
}
