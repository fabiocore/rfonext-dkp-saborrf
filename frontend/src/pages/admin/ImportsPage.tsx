import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchGuildSettings, fetchImports, uploadImport } from '../../api/client';

interface BatchResult {
  fileName: string;
  status: 'success' | 'skipped' | 'error';
  message: string;
}

export function ImportsPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<BatchResult[]>([]);

  const importsQuery = useQuery({ queryKey: ['imports'], queryFn: fetchImports });
  const settingsQuery = useQuery({ queryKey: ['guild-settings'], queryFn: fetchGuildSettings });
  const currencyAbbr = settingsQuery.data?.currencyAbbr ?? 'BRC';

  async function handleFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    // Processa em ordem cronológica (o padrão de nome AAAAMMDD_HHMMSS_...
    // já ordena assim alfabeticamente) — importa fazer nessa ordem pra
    // "Última vez visto"/"Saiu" refletirem a sequência real dos dias.
    const sorted = files.slice().sort((a, b) => a.name.localeCompare(b.name));

    setIsRunning(true);
    setResults([]);
    const collected: BatchResult[] = [];

    for (const file of sorted) {
      try {
        const result = await uploadImport(file);
        const newActivitiesNote =
          result.newActivityNames.length > 0 ? ` (${result.newActivityNames.join(', ')})` : '';
        const reuploadNote = result.isFirstImportForDate ? '' : ' — reenvio do mesmo dia, status "Saiu" não foi reavaliado.';
        collected.push({
          fileName: file.name,
          status: 'success',
          message: `${result.rowCount} personagens, ${result.newCharactersDetected} novos, ${result.newActivitiesDetected} atividades novas${newActivitiesNote}, ${result.emittedCount} emissões.${reuploadNote}`,
        });
      } catch (err: any) {
        const isDuplicate = err?.response?.status === 409;
        collected.push({
          fileName: file.name,
          status: isDuplicate ? 'skipped' : 'error',
          message: err?.response?.data?.message ?? 'Falha ao importar o arquivo.',
        });
      }
      // Atualiza a cada arquivo processado, pra dar feedback de progresso em lotes grandes.
      setResults([...collected]);
    }

    queryClient.invalidateQueries({ queryKey: ['imports'] });
    queryClient.invalidateQueries({ queryKey: ['balances'] });
    setIsRunning(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <section>
      <h2>Importações de XML</h2>
      <p className="subtitle">
        Envie o(s) arquivo(s) exportado(s) pelo jogo (padrão AAAAMMDD_HHMMSS_NomeDaGuild.xml) — pode selecionar vários
        de uma vez pra colocar em dia dias em que esqueceu de enviar. A data de cada um vem do próprio nome do
        arquivo. A emissão de {currencyAbbr} usa sempre o valor de cada atividade{' '}
        <strong>no momento do import</strong> — mudar um valor depois nunca reprocessa dias antigos, só passa a
        valer pros próximos.
      </p>
      <p className="subtitle">
        <strong>Reenviar o mesmo dia é seguro.</strong> O jogo às vezes atualiza o XML do dia depois que algumas
        pessoas já fizeram check-in/doação/atividade — pode reenviar um arquivo mais novo da mesma data quantas vezes
        precisar, o sistema nunca emite {currencyAbbr} duas vezes pra quem já recebeu (só emite pra quem ficou de fora
        do arquivo anterior). Só a primeira importação de cada dia reavalia quem "Saiu" da guild — reenvios não
        mexem nisso de novo.
      </p>
      <p className="subtitle">
        <strong>Configurando uma guild nova?</strong> Antes do primeiro import de verdade, você pode importar uma
        cópia do arquivo do jogo só com a linha de cabeçalho (sem nenhuma linha de personagem) — isso cria o
        catálogo de Atividades zerado, sem afetar nenhum personagem — ou, melhor ainda, pré-cadastrar os nomes e
        valores já em "Atividades do Jogo" antes de qualquer import, se você já sabe quais atividades vão aparecer.
      </p>

      <div className="upload-box">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xml"
          multiple
          onChange={handleFilesChange}
          disabled={isRunning}
        />
        {isRunning && <p>Importando {results.length + 1}...</p>}
        {results.map((r) => (
          <p key={r.fileName} className={r.status === 'success' ? 'form-success' : 'form-error'}>
            {r.fileName}: {r.status === 'skipped' ? 'pulado — ' : r.status === 'error' ? 'erro — ' : ''}
            {r.message}
          </p>
        ))}
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>Arquivo</th>
            <th>Data</th>
            <th>Linhas</th>
            <th>Novos personagens</th>
            <th>Novas atividades</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {importsQuery.data?.map((batch) => (
            <tr key={batch.id}>
              <td>{batch.fileName}</td>
              <td>{new Date(batch.referenceDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</td>
              <td>{batch.rowCount}</td>
              <td>{batch.newCharactersDetected}</td>
              <td>{batch.newActivitiesDetected}</td>
              <td>{batch.status === 'PROCESSED' ? 'Processado' : 'Falhou'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
