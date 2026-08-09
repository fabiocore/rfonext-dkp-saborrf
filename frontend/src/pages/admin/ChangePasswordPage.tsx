import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { changePassword, fetchRecoveryCodeStatus, setRecoveryCode } from '../../api/client';

function RecoveryCodeCard() {
  const queryClient = useQueryClient();
  const statusQuery = useQuery({ queryKey: ['recovery-code-status'], queryFn: fetchRecoveryCodeStatus });
  const [currentPassword, setCurrentPassword] = useState('');
  const [recoveryCode, setRecoveryCodeValue] = useState('');
  const [confirmCode, setConfirmCode] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const mutation = useMutation({
    mutationFn: () => setRecoveryCode(currentPassword, recoveryCode),
    onSuccess: () => {
      setCurrentPassword('');
      setRecoveryCodeValue('');
      setConfirmCode('');
      setFormError(null);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
      queryClient.invalidateQueries({ queryKey: ['recovery-code-status'] });
    },
    onError: (err: any) => setFormError(err?.response?.data?.message ?? 'Falha ao salvar o código de recuperação.'),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (recoveryCode.length < 10) {
      setFormError('O código de recuperação precisa ter pelo menos 10 caracteres.');
      return;
    }
    if (recoveryCode !== confirmCode) {
      setFormError('A confirmação não bate com o código digitado.');
      return;
    }
    mutation.mutate();
  }

  return (
    <section style={{ marginTop: 32 }}>
      <h2>Código de Recuperação</h2>
      <p className="subtitle">
        Se você esquecer a senha e não conseguir logar, esse código permite definir uma senha nova sozinho, sem
        depender de acesso ao servidor. Guarde em lugar seguro — ele não expira nem é consumido no uso, então
        continua valendo até você trocar por outro aqui.
      </p>
      {statusQuery.data && (
        <p className="subtitle">
          {statusQuery.data.isSet
            ? `Código definido em ${new Date(statusQuery.data.updatedAt!).toLocaleString('pt-BR')}. Preencha abaixo pra trocar por um novo.`
            : 'Nenhum código de recuperação definido ainda.'}
        </p>
      )}

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
          Código de recuperação (mín. 10 caracteres)
          <input
            type="text"
            value={recoveryCode}
            onChange={(e) => setRecoveryCodeValue(e.target.value)}
            required
            minLength={10}
          />
        </label>
        <label>
          Confirmar código
          <input type="text" value={confirmCode} onChange={(e) => setConfirmCode(e.target.value)} required minLength={10} />
        </label>
        {formError && <p className="form-error">{formError}</p>}
        {success && <p className="form-success">Código de recuperação salvo com sucesso.</p>}
        <button type="submit" disabled={mutation.isPending}>
          {statusQuery.data?.isSet ? 'Trocar código' : 'Definir código'}
        </button>
      </form>
    </section>
  );
}

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

      <RecoveryCodeCard />
    </section>
  );
}
