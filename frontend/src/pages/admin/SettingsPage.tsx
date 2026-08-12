import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchGuildSettings,
  fetchWeeklyTaxRuns,
  isGmLevel,
  runWeeklyTaxNow,
  updateGuildSettings,
  updatePinnedAnnouncement,
} from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { localWeekdaysAndTimeToUtc, utcWeekdaysAndTimeToLocal } from '../../utils/scheduleTimezone';

const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

function WeeklyTaxManualTrigger({
  weekdayLabel,
  timeLabel,
  percent,
  currencyAbbr,
}: {
  weekdayLabel: string;
  timeLabel: string;
  percent: number;
  currencyAbbr: string;
}) {
  const queryClient = useQueryClient();
  const runsQuery = useQuery({ queryKey: ['weekly-tax-runs'], queryFn: fetchWeeklyTaxRuns });
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (reason: string) => runWeeklyTaxNow(reason),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['weekly-tax-runs'] });
      queryClient.invalidateQueries({ queryKey: ['characters'] });
      queryClient.invalidateQueries({ queryKey: ['balances'] });
      queryClient.invalidateQueries({ queryKey: ['public-feed'] });
    },
    onError: (err: any) => setError(err?.response?.data?.message ?? 'Falha ao rodar o imposto semanal.'),
  });

  const lastRun = runsQuery.data?.[0];

  function handleRunNow() {
    const reason = prompt(
      `Motivo pra rodar o imposto semanal agora, fora do horário automático (obrigatório):`,
    );
    if (!reason?.trim()) return;
    const confirmed = confirm(
      `Confirma rodar o imposto semanal agora? Isso vai queimar ${percent}% do saldo disponível de todos os Principais imediatamente — não é o horário automático (${weekdayLabel}, ${timeLabel}).\n\nMotivo: ${reason.trim()}`,
    );
    if (!confirmed) return;
    setError(null);
    mutation.mutate(reason.trim());
  }

  return (
    <>
      <h3>Imposto semanal manual</h3>
      <p className="subtitle">
        Só o GM pode rodar fora do horário automático — sempre com motivo obrigatório e confirmação, ex: pra recuperar
        uma semana em que o imposto automático não rodou (servidor fora do ar no horário, etc).
      </p>
      {lastRun && (
        <p className="subtitle">
          Última execução: {new Date(lastRun.executedAt).toLocaleString('pt-BR')} —{' '}
          {lastRun.triggeredManually ? 'manual' : 'automática'}, {lastRun.percentApplied}%,{' '}
          {lastRun.totalCharactersTaxed} personagem(ns), {lastRun.totalAmountBurned} {currencyAbbr} queimado(s)
          {lastRun.reason && <> — motivo: {lastRun.reason}</>}
        </p>
      )}
      <button type="button" onClick={handleRunNow} disabled={mutation.isPending}>
        Rodar imposto semanal agora
      </button>
      {error && <p className="form-error">{error}</p>}

      {runsQuery.data && runsQuery.data.length > 0 && (
        <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Tipo</th>
              <th>%</th>
              <th>Personagens</th>
              <th>Total queimado</th>
              <th>Motivo</th>
            </tr>
          </thead>
          <tbody>
            {runsQuery.data.map((run) => (
              <tr key={run.id}>
                <td>{new Date(run.executedAt).toLocaleString('pt-BR')}</td>
                <td>{run.triggeredManually ? 'Manual' : 'Automático'}</td>
                <td>{run.percentApplied}%</td>
                <td>{run.totalCharactersTaxed}</td>
                <td>{run.totalAmountBurned} {currencyAbbr}</td>
                <td>{run.reason ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </>
  );
}

function PinnedAnnouncementEditor({ initialText }: { initialText: string | null }) {
  const queryClient = useQueryClient();
  const [text, setText] = useState(initialText ?? '');
  const [saved, setSaved] = useState(false);

  useEffect(() => setText(initialText ?? ''), [initialText]);

  const mutation = useMutation({
    mutationFn: () => updatePinnedAnnouncement(text),
    onSuccess: () => {
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ['guild-settings'] });
      setTimeout(() => setSaved(false), 3000);
    },
  });

  return (
    <>
      <h3>Aviso fixo (home pública)</h3>
      <p className="subtitle">
        Fica sempre visível no topo da home, separado do Mural normal — só o GM edita. Deixe em branco pra esconder.
      </p>
      <form
        className="settings-form"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <label>
          Texto do aviso fixo
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} />
        </label>
        <button type="submit" disabled={mutation.isPending}>
          Salvar aviso fixo
        </button>
        {saved && <span className="form-success">Salvo!</span>}
      </form>
    </>
  );
}

export function SettingsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const gmLevel = isGmLevel(user?.role);
  const settingsQuery = useQuery({ queryKey: ['guild-settings'], queryFn: fetchGuildSettings });

  const [guildName, setGuildName] = useState('');
  const [currencyName, setCurrencyName] = useState('');
  const [currencyAbbr, setCurrencyAbbr] = useState('');
  const [weeklyTaxPercent, setWeeklyTaxPercent] = useState(10);
  // Dia/horário são guardados em UTC no banco (weeklyTaxWeekday/weeklyTaxTimeUtcMinutes),
  // mas o GM pensa e digita no fuso dele — convertidos na entrada/saída do
  // formulário com o mesmo utilitário já usado pra agenda recorrente de
  // Atividades/Eventos (scheduleTimezone.ts), inclusive o cuidado de o
  // horário local poder "virar o dia" ao converter pra UTC.
  const [weeklyTaxWeekdayLocal, setWeeklyTaxWeekdayLocal] = useState(1);
  const [weeklyTaxTimeLocal, setWeeklyTaxTimeLocal] = useState('05:00');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!settingsQuery.data) return;
    setGuildName(settingsQuery.data.guildName);
    setCurrencyName(settingsQuery.data.currencyName);
    setCurrencyAbbr(settingsQuery.data.currencyAbbr);
    setWeeklyTaxPercent(settingsQuery.data.weeklyTaxPercent);
    const local = utcWeekdaysAndTimeToLocal(
      [settingsQuery.data.weeklyTaxWeekday],
      settingsQuery.data.weeklyTaxTimeUtcMinutes,
    );
    setWeeklyTaxWeekdayLocal(local.weekdaysLocal[0] ?? settingsQuery.data.weeklyTaxWeekday);
    setWeeklyTaxTimeLocal(local.timeLocal);
  }, [settingsQuery.data]);

  const mutation = useMutation({
    mutationFn: () => {
      const { weekdaysUtc, timeUtcMinutes } = localWeekdaysAndTimeToUtc([weeklyTaxWeekdayLocal], weeklyTaxTimeLocal);
      return updateGuildSettings({
        guildName,
        currencyName,
        currencyAbbr,
        weeklyTaxPercent,
        weeklyTaxWeekday: weekdaysUtc[0],
        weeklyTaxTimeUtcMinutes: timeUtcMinutes,
      });
    },
    onSuccess: () => {
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ['guild-settings'] });
      setTimeout(() => setSaved(false), 3000);
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (weeklyTaxPercent < 1 || weeklyTaxPercent > 20) return;
    mutation.mutate();
  }

  return (
    <section>
      <h2>Configurações da Guild</h2>
      <p className="subtitle">Tudo aqui é o que muda de guild pra guild — nada disso é fixo no sistema.</p>

      <form className="settings-form" onSubmit={handleSubmit}>
        <label>
          Nome da guild
          <input value={guildName} onChange={(e) => setGuildName(e.target.value)} required />
        </label>
        <label>
          Nome da moeda
          <input value={currencyName} onChange={(e) => setCurrencyName(e.target.value)} required />
        </label>
        <label>
          Sigla da moeda
          <input value={currencyAbbr} onChange={(e) => setCurrencyAbbr(e.target.value)} required />
        </label>
        <label>
          Imposto semanal (%) — entre 1 e 20
          <input
            type="number"
            min={1}
            max={20}
            value={weeklyTaxPercent}
            onChange={(e) => setWeeklyTaxPercent(Number(e.target.value))}
          />
        </label>
        <label>
          Dia da coleta de impostos semanal (seu fuso)
          <select value={weeklyTaxWeekdayLocal} onChange={(e) => setWeeklyTaxWeekdayLocal(Number(e.target.value))}>
            {WEEKDAYS.map((day, index) => (
              <option key={day} value={index}>
                {day}
              </option>
            ))}
          </select>
        </label>
        <label>
          Horário de cobrança do imposto semanal (seu fuso)
          <input type="time" value={weeklyTaxTimeLocal} onChange={(e) => setWeeklyTaxTimeLocal(e.target.value)} />
        </label>

        <button type="submit" disabled={mutation.isPending}>
          Salvar configurações
        </button>
        {saved && <span className="form-success">Salvo!</span>}
      </form>

      {gmLevel && <PinnedAnnouncementEditor initialText={settingsQuery.data?.pinnedAnnouncementText ?? null} />}

      {gmLevel && (
        <WeeklyTaxManualTrigger
          weekdayLabel={WEEKDAYS[weeklyTaxWeekdayLocal]}
          timeLabel={weeklyTaxTimeLocal}
          percent={weeklyTaxPercent}
          currencyAbbr={settingsQuery.data?.currencyAbbr ?? ''}
        />
      )}
    </section>
  );
}
