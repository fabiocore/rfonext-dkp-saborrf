import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { changePassword } from '../../api/client';

export function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const mutation = useMutation({
    mutationFn: () => changePassword(currentPassword, newPassword),
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setFormError(null);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    },
    onError: (err: any) => setFormError(err?.response?.data?.message ?? 'Falha ao trocar a senha.'),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (newPassword.length < 8) {
      setFormError('A nova senha precisa ter pelo menos 8 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setFormError('A confirmação não bate com a nova senha.');
      return;
    }
    mutation.mutate();
  }

  return (
    <section>
      <h2>Minha Senha</h2>
      <p className="subtitle">Troque sua própria senha de acesso ao painel. Precisa confirmar a senha atual.</p>

      <form className="settings-form" onSubmit={handleSubmit} style={{ maxWidth: 360 }}>
        <label>
          Senha atual
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </label>
        <label>
          Nova senha (mín. 8 caracteres)
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} />
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
        {formError && <p className="form-error">{formError}</p>}
        {success && <p className="form-success">Senha trocada com sucesso.</p>}
        <button type="submit" disabled={mutation.isPending}>
          Trocar senha
        </button>
      </form>
    </section>
  );
}
