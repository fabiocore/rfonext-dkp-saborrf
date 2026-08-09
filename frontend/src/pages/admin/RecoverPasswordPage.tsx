import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { recoverPassword } from '../../api/client';

export function RecoverPasswordPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [recoveryCode, setRecoveryCodeValue] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const mutation = useMutation({
    mutationFn: () => recoverPassword(username, recoveryCode, newPassword),
    onSuccess: () => setSuccess(true),
    onError: (err: any) =>
      setError(err?.response?.data?.message ?? 'Usuário ou código de recuperação inválidos.'),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) {
      setError('A nova senha precisa ter pelo menos 8 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('A confirmação não bate com a nova senha.');
      return;
    }
    mutation.mutate();
  }

  if (success) {
    return (
      <div className="admin-login-shell">
        <div className="admin-login-card">
          <h1>RFONext DKP</h1>
          <p className="subtitle">Senha redefinida com sucesso.</p>
          <button type="button" onClick={() => navigate('/admin/login', { replace: true })}>
            Ir pro login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-login-shell">
      <form className="admin-login-card" onSubmit={handleSubmit}>
        <h1>RFONext DKP</h1>
        <p className="subtitle">
          Redefinir senha usando o código de recuperação definido previamente em Minha Senha.
        </p>

        <label>
          Usuário
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus required />
        </label>
        <label>
          Código de recuperação
          <input value={recoveryCode} onChange={(e) => setRecoveryCodeValue(e.target.value)} required />
        </label>
        <label>
          Nova senha (mín. 8 caracteres)
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
          />
        </label>
        <label>
          Confirmar nova senha
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
          />
        </label>

        {error && <p className="form-error">{error}</p>}

        <button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Enviando...' : 'Redefinir senha'}
        </button>
        <p className="subtitle" style={{ marginTop: 12 }}>
          <Link to="/admin/login">← Voltar ao login</Link>
        </p>
      </form>
    </div>
  );
}
