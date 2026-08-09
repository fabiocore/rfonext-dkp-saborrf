import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { downloadBackup, restoreBackup } from '../../api/client';

const RESTORE_CONFIRM_TEXT = 'RESTAURAR';

export function BackupPage() {
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const downloadMutation = useMutation({
    mutationFn: downloadBackup,
    onError: (err: any) => setDownloadError(err?.response?.data?.message ?? 'Falha ao gerar o backup.'),
  });

  const [file, setFile] = useState<File | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreSuccess, setRestoreSuccess] = useState(false);

  const restoreMutation = useMutation({
    mutationFn: () => restoreBackup(file!, confirmText),
    onSuccess: () => {
      setRestoreSuccess(true);
      setRestoreError(null);
      setFile(null);
      setConfirmText('');
    },
    onError: (err: any) => setRestoreError(err?.response?.data?.message ?? 'Falha ao restaurar o backup.'),
  });

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    setFile(e.target.files?.[0] ?? null);
    setRestoreSuccess(false);
    setRestoreError(null);
  }

  function handleRestoreSubmit(e: FormEvent) {
    e.preventDefault();
    setRestoreSuccess(false);
    setRestoreError(null);
    if (!file) {
      setRestoreError('Selecione um arquivo .sql antes.');
      return;
    }
    if (confirmText.trim().toUpperCase() !== RESTORE_CONFIRM_TEXT) {
      setRestoreError(`Digite exatamente "${RESTORE_CONFIRM_TEXT}" no campo de confirmação.`);
      return;
    }
    const reallyConfirmed = confirm(
      `Isso vai APAGAR TODOS os dados atuais (personagens, saldos, extrato, leilões, tudo) e substituir pelo conteúdo de "${file.name}". Não dá pra desfazer. Recomendamos baixar um backup atual antes, caso precise voltar atrás.\n\nTem certeza que quer continuar?`,
    );
    if (!reallyConfirmed) return;
    restoreMutation.mutate();
  }

  return (
    <section>
      <h2>Backup e Restauração</h2>
      <p className="subtitle">Exclusivo do GM. Cobre o banco de dados inteiro (personagens, extrato, leilões, configurações).</p>

      <h3>Backup</h3>
      <p className="subtitle">
        Baixa um arquivo <code>.sql</code> com todos os dados de agora. Prints/imagens enviadas (comprovantes, itens,
        logo) não entram nesse arquivo — ficam guardadas à parte no servidor.
      </p>
      <button type="button" onClick={() => downloadMutation.mutate()} disabled={downloadMutation.isPending}>
        {downloadMutation.isPending ? 'Gerando...' : 'Baixar backup agora'}
      </button>
      {downloadError && <p className="form-error">{downloadError}</p>}

      <h3 style={{ marginTop: 28 }}>Restauração</h3>
      <p className="subtitle">
        <strong>Cuidado:</strong> restaurar apaga tudo que existe agora e substitui pelo conteúdo do arquivo enviado.
        Não dá pra desfazer — baixe um backup atual antes, se quiser poder voltar atrás.
      </p>
      <form className="settings-form" onSubmit={handleRestoreSubmit}>
        <label>
          Arquivo de backup (.sql)
          <input type="file" accept=".sql" onChange={handleFileChange} />
        </label>
        <label>
          Digite "{RESTORE_CONFIRM_TEXT}" pra confirmar
          <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={RESTORE_CONFIRM_TEXT} />
        </label>
        {restoreError && <p className="form-error">{restoreError}</p>}
        {restoreSuccess && <p className="form-success">Restauração concluída! Os dados atuais foram substituídos.</p>}
        <button type="submit" disabled={restoreMutation.isPending || !file}>
          {restoreMutation.isPending ? 'Restaurando...' : 'Restaurar backup'}
        </button>
      </form>
    </section>
  );
}
