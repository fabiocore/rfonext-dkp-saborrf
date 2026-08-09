import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createActivity,
  createKnownActivity,
  fetchActivities,
  fetchGuildSettings,
  setActivityComponents,
  updateActivity,
  type Activity,
} from '../../api/client';
import { ImageUploadInput } from '../../components/ImageUploadInput';
import { GearIcon } from '../../components/GearIcon';
import { CalendarIcon } from '../../components/CalendarIcon';
import {
  localDatetimeInputToUtcIso,
  localWeekdaysAndTimeToUtc,
  utcIsoToLocalDatetimeInput,
  utcWeekdaysAndTimeToLocal,
} from '../../utils/scheduleTimezone';

export const WEEKDAY_LABELS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

function ComponentsEditor({ activity, allActivities }: { activity: Activity; allActivities: Activity[] }) {
  const queryClient = useQueryClient();
  const currentIds = new Set(activity.componentsOf.map((c) => c.componentActivityId));
  const [selected, setSelected] = useState<Set<string>>(currentIds);

  const candidates = allActivities.filter((a) => a.id !== activity.id && !a.isComposite);

  const mutation = useMutation({
    mutationFn: () => setActivityComponents(activity.id, Array.from(selected)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['activities'] }),
  });

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  return (
    <div className="components-editor">
      <p>Marque as atividades que precisam estar TODAS marcadas no mesmo dia para "{activity.name}" pagar:</p>
      <div className="checkbox-grid">
        {candidates.map((c) => (
          <label key={c.id}>
            <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
            {c.name}
          </label>
        ))}
      </div>
      <button type="button" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
        Salvar
      </button>
    </div>
  );
}

export function ScheduleEditor({ activity }: { activity: Activity }) {
  const queryClient = useQueryClient();
  const [scheduleType, setScheduleType] = useState(activity.scheduleType);
  const [scheduleOneTimeAt, setScheduleOneTimeAt] = useState(
    activity.scheduleOneTimeAt ? utcIsoToLocalDatetimeInput(activity.scheduleOneTimeAt) : '',
  );
  const [imageUrl, setImageUrl] = useState<string | null>(activity.imageUrl);

  // Os dias/horário salvos vêm em UTC; decodifica pro fuso de quem está
  // editando agora só pra preencher o formulário — a conversão de volta pra
  // UTC acontece de novo ao salvar (nunca fica “preso” no fuso de quem
  // cadastrou primeiro).
  const initialLocal = utcWeekdaysAndTimeToLocal(
    activity.scheduleWeekdaysUtc,
    activity.scheduleTimeUtcMinutes ?? 0,
  );
  const [weekdaysLocal, setWeekdaysLocal] = useState<Set<number>>(new Set(initialLocal.weekdaysLocal));
  const [timeLocal, setTimeLocal] = useState(activity.scheduleTimeUtcMinutes !== null ? initialLocal.timeLocal : '20:00');

  const mutation = useMutation({
    mutationFn: () => {
      const { weekdaysUtc, timeUtcMinutes } =
        scheduleType === 'RECURRING' && weekdaysLocal.size > 0
          ? localWeekdaysAndTimeToUtc(Array.from(weekdaysLocal), timeLocal)
          : { weekdaysUtc: [], timeUtcMinutes: null as number | null };
      return updateActivity(activity.id, {
        scheduleType,
        scheduleOneTimeAt:
          scheduleType === 'ONE_TIME' && scheduleOneTimeAt ? localDatetimeInputToUtcIso(scheduleOneTimeAt) : null,
        scheduleWeekdaysUtc: scheduleType === 'RECURRING' ? weekdaysUtc : [],
        scheduleTimeUtcMinutes: scheduleType === 'RECURRING' ? timeUtcMinutes : null,
        imageUrl,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      queryClient.invalidateQueries({ queryKey: ['public-events'] });
    },
  });

  function toggleWeekday(day: number) {
    const next = new Set(weekdaysLocal);
    if (next.has(day)) next.delete(day);
    else next.add(day);
    setWeekdaysLocal(next);
  }

  return (
    <div className="components-editor">
      <p>Agenda pro painel público de eventos (puramente informativo — nada aqui dispara ação automática):</p>
      <div className="settings-form">
        <label>
          Tipo de agenda
          <select value={scheduleType} onChange={(e) => setScheduleType(e.target.value as Activity['scheduleType'])}>
            <option value="NONE">Sem agenda fixa</option>
            <option value="ONE_TIME">Data única</option>
            <option value="RECURRING">Recorrente</option>
          </select>
        </label>
        {scheduleType === 'ONE_TIME' && (
          <label>
            Data/hora
            <input type="datetime-local" value={scheduleOneTimeAt} onChange={(e) => setScheduleOneTimeAt(e.target.value)} />
          </label>
        )}
        {scheduleType === 'RECURRING' && (
          <>
            <div>
              <p style={{ margin: '0 0 4px' }}>Dias da semana</p>
              <div className="checkbox-grid">
                {WEEKDAY_LABELS.map((label, day) => (
                  <label key={day}>
                    <input type="checkbox" checked={weekdaysLocal.has(day)} onChange={() => toggleWeekday(day)} />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <label>
              Horário (no seu fuso — os visitantes veem convertido pro fuso deles)
              <input type="time" value={timeLocal} onChange={(e) => setTimeLocal(e.target.value)} />
            </label>
          </>
        )}
        <label>
          Imagem (opcional)
          <ImageUploadInput value={imageUrl} onChange={setImageUrl} />
        </label>
        <button type="button" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          Salvar
        </button>
      </div>
    </div>
  );
}

function ActivityRow({ activity, allActivities }: { activity: Activity; allActivities: Activity[] }) {
  const queryClient = useQueryClient();
  const [brcValue, setBrcValue] = useState(activity.brcValue);
  const [showOnEventsPanel, setShowOnEventsPanel] = useState(activity.showOnEventsPanel);
  const [recurrencePeriod, setRecurrencePeriod] = useState(activity.recurrencePeriod);
  const [maxOccurrences, setMaxOccurrences] = useState(activity.maxOccurrencesPerPeriod);
  const [expanded, setExpanded] = useState<'components' | 'schedule' | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      updateActivity(activity.id, {
        brcValue,
        showOnEventsPanel,
        recurrencePeriod,
        maxOccurrencesPerPeriod: recurrencePeriod === 'DAILY' ? 1 : maxOccurrences,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      queryClient.invalidateQueries({ queryKey: ['balances'] });
      queryClient.invalidateQueries({ queryKey: ['public-events'] });
    },
  });

  const dirty =
    brcValue !== activity.brcValue ||
    showOnEventsPanel !== activity.showOnEventsPanel ||
    recurrencePeriod !== activity.recurrencePeriod ||
    (recurrencePeriod !== 'DAILY' && maxOccurrences !== activity.maxOccurrencesPerPeriod);

  return (
    <>
      <tr>
        <td>
          {activity.name} {activity.isNameLocked && <span className="badge">do jogo</span>}
        </td>
        <td>
          <input
            type="number"
            min={0}
            value={brcValue}
            onChange={(e) => setBrcValue(Number(e.target.value))}
            style={{ width: 70 }}
          />
        </td>
        <td>{activity.isComposite ? 'Composta' : 'Simples'}</td>
        <td>
          <select
            value={recurrencePeriod}
            onChange={(e) => setRecurrencePeriod(e.target.value as Activity['recurrencePeriod'])}
          >
            <option value="DAILY">Diária (reseta todo dia)</option>
            <option value="WEEKLY">Semanal (reseta segunda 07h GMT-3)</option>
            <option value="MONTHLY">Mensal (reseta dia 1º 07h GMT-3)</option>
          </select>
          {recurrencePeriod !== 'DAILY' && (
            <>
              {' '}
              <label>
                vezes por período{' '}
                <input
                  type="number"
                  min={1}
                  value={maxOccurrences}
                  onChange={(e) => setMaxOccurrences(Math.max(1, Number(e.target.value)))}
                  style={{ width: 50 }}
                />
              </label>
            </>
          )}
        </td>
        <td>
          <input type="checkbox" checked={showOnEventsPanel} onChange={(e) => setShowOnEventsPanel(e.target.checked)} />
        </td>
        <td>
          <button type="button" disabled={!dirty || mutation.isPending} onClick={() => mutation.mutate()}>
            Salvar
          </button>{' '}
          <button
            type="button"
            className="icon-btn"
            title="Opções"
            aria-label="Opções"
            onClick={() => setExpanded(expanded === 'components' ? null : 'components')}
          >
            <GearIcon />
          </button>{' '}
          <button
            type="button"
            className="icon-btn"
            title="Agenda"
            aria-label="Agenda"
            onClick={() => setExpanded(expanded === 'schedule' ? null : 'schedule')}
          >
            <CalendarIcon />
          </button>
        </td>
      </tr>
      {expanded === 'components' && (
        <tr>
          <td colSpan={6}>
            <ComponentsEditor activity={activity} allActivities={allActivities} />
          </td>
        </tr>
      )}
      {expanded === 'schedule' && (
        <tr>
          <td colSpan={6}>
            <ScheduleEditor activity={activity} />
          </td>
        </tr>
      )}
    </>
  );
}

// Nomes reais das colunas do jogo, já vistos em imports de verdade desta
// guild — não é conhecimento genérico sobre "RF Online Next", é a lista
// observada diretamente nos arquivos que já passaram pelo sistema. Serve só
// pra evitar o GM ter que digitar/arriscar um nome errado; se aparecer uma
// coluna nova que não está aqui, ela continua sendo detectada normalmente
// (e criada automaticamente com valor 0) no próximo import de verdade.
const KNOWN_GAME_ACTIVITY_NAMES = [
  'Verificado',
  'Doar',
  'Atividade da Guilda',
  'Raid de Guilda',
  'Expedição da Guilda',
  'Confronto pelo Paraíso',
  'Campo de Batalha de Aço',
  'Escaramuça',
  'Fortaleza Albern',
  'Guerra de Mineração',
];

/**
 * Pré-cadastra atividades do jogo que ainda não apareceram em nenhum
 * import — pra guilds novas já começarem com o valor certo na primeira
 * importação real, sem precisar digitar nome nenhum (a lista já vem dos
 * nomes reais observados). Some sozinha quando não sobra nenhuma pra
 * pré-cadastrar.
 */
function CreateKnownActivityForm({ currencyAbbr, existingNames }: { currencyAbbr: string; existingNames: Set<string> }) {
  const queryClient = useQueryClient();
  const missing = KNOWN_GAME_ACTIVITY_NAMES.filter((name) => !existingNames.has(name));
  const [values, setValues] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const names = Array.from(selected);
      for (const name of names) {
        await createKnownActivity(name, values[name] ?? 0);
      }
      return names;
    },
    onSuccess: (names) => {
      setSuccess(`Pré-cadastrada(s): ${names.join(', ')} — conecta automaticamente no primeiro import real.`);
      setError(null);
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ['activities'] });
    },
    onError: (err: any) => {
      setSuccess(null);
      setError(err?.response?.data?.message ?? 'Falha ao pré-cadastrar.');
    },
  });

  function toggle(name: string) {
    const next = new Set(selected);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setSelected(next);
  }

  if (missing.length === 0) return null;

  return (
    <div className="components-editor">
      <p>
        <strong>Pré-cadastrar atividades conhecidas</strong> — atividades do jogo que ainda não apareceram em nenhum
        import desta guild. Marque as que quiser já configurar com um valor antes do primeiro import de verdade.
      </p>
      <div className="checkbox-grid">
        {missing.map((name) => (
          <label key={name}>
            <input type="checkbox" checked={selected.has(name)} onChange={() => toggle(name)} />
            {name}
            {selected.has(name) && (
              <input
                type="number"
                min={0}
                value={values[name] ?? 0}
                onChange={(e) => setValues({ ...values, [name]: Number(e.target.value) })}
                style={{ width: 70, marginLeft: 8 }}
              />
            )}
          </label>
        ))}
      </div>
      {error && <p className="form-error">{error}</p>}
      {success && <p className="form-success">{success}</p>}
      <button type="button" onClick={() => mutation.mutate()} disabled={mutation.isPending || selected.size === 0}>
        Pré-cadastrar selecionadas ({currencyAbbr})
      </button>
    </div>
  );
}

/**
 * Cria uma atividade composta (ex: "Diária") a partir de outras
 * atividades-coluna do jogo já existentes. Exige pelo menos 1 componente
 * marcado — se não fosse obrigatório, a atividade recém-criada ficaria como
 * MANUAL simples (indistinguível de um Evento Personalizado) até alguém
 * voltar aqui pra marcar os componentes, uma janela de confusão evitável
 * exigindo tudo num único passo.
 */
function CreateCompositeActivityForm({
  xmlActivities,
  currencyAbbr,
}: {
  xmlActivities: Activity[];
  currencyAbbr: string;
}) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState('');
  const [brcValue, setBrcValue] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const mutation = useMutation({
    mutationFn: async () => {
      const activity = await createActivity({ name, brcValue });
      return setActivityComponents(activity.id, Array.from(selected));
    },
    onSuccess: () => {
      setName('');
      setBrcValue(0);
      setSelected(new Set());
      setExpanded(false);
      queryClient.invalidateQueries({ queryKey: ['activities'] });
    },
  });

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || selected.size === 0) return;
    mutation.mutate();
  }

  if (!expanded) {
    return (
      <button type="button" onClick={() => setExpanded(true)}>
        + Criar atividade composta
      </button>
    );
  }

  return (
    <form className="settings-form" onSubmit={handleSubmit}>
      <label>
        Nome da atividade composta
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder='ex: "Diária"' required />
      </label>
      <label>
        Valor ({currencyAbbr})
        <input type="number" min={0} value={brcValue} onChange={(e) => setBrcValue(Number(e.target.value))} style={{ width: 90 }} />
      </label>
      <div>
        <p style={{ margin: '0 0 4px' }}>Precisa estar TODAS marcadas no mesmo dia (ao menos 1):</p>
        <div className="checkbox-grid">
          {xmlActivities.map((a) => (
            <label key={a.id}>
              <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggle(a.id)} />
              {a.name}
            </label>
          ))}
        </div>
      </div>
      <button type="submit" disabled={mutation.isPending || !name.trim() || selected.size === 0}>
        Criar atividade composta
      </button>{' '}
      <button type="button" onClick={() => setExpanded(false)}>
        Cancelar
      </button>
    </form>
  );
}

export function ActivitiesPage() {
  const activitiesQuery = useQuery({ queryKey: ['activities'], queryFn: fetchActivities });
  const settingsQuery = useQuery({ queryKey: ['guild-settings'], queryFn: fetchGuildSettings });
  const currencyAbbr = settingsQuery.data?.currencyAbbr ?? 'BRC';
  const allActivities = activitiesQuery.data ?? [];
  // Atividades do Jogo = só o que vem das colunas do XML, ou composições
  // delas (ex: "Diária"). Eventos personalizados (manuais, simples) vivem
  // na tela Eventos Personalizados.
  const gameActivities = allActivities.filter((a) => a.sourceType === 'XML_COLUMN' || a.isComposite);
  const xmlActivities = allActivities.filter((a) => a.sourceType === 'XML_COLUMN');

  return (
    <section>
      <h2>Atividades do Jogo</h2>
      <p className="subtitle">
        Vêm das colunas do XML importado — nome travado, valor editável. Componha atividades (ex: "Diária") a partir
        de várias colunas existentes, e marque "Painel público" + agenda pra elas aparecerem em "Próximos Eventos"
        na home. Pra criar um evento personalizado (não vindo do jogo), use a tela "Eventos Personalizados".
      </p>
      <p className="subtitle">
        <strong>Frequência importa</strong> (corrigido em 2026-08-09): algumas colunas do jogo resetam todo dia (ex:
        Verificado). Outras não resetam todo dia — ficam marcadas por vários dias seguidos representando o MESMO
        evento (ex: Raid de Guilda continua "marcado" no dia seguinte ao raid), resetando só semanalmente (toda
        segunda 07h GMT-3) ou mensalmente (todo dia 1º 07h GMT-3), sempre pagando no máximo "vezes por período" vezes
        dentro daquela janela — se ficarem como "Diária" por engano, o sistema paga o mesmo evento várias vezes.
        Confira cada atividade e ajuste — só você sabe como cada uma se comporta de verdade no jogo.
      </p>

      <CreateKnownActivityForm currencyAbbr={currencyAbbr} existingNames={new Set(allActivities.map((a) => a.name))} />
      <CreateCompositeActivityForm xmlActivities={xmlActivities} currencyAbbr={currencyAbbr} />

      <table className="data-table">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Valor</th>
            <th>Tipo</th>
            <th>Frequência</th>
            <th>Painel público</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {gameActivities.map((activity) => (
            // updatedAt no key força remontar (e resincronizar todo estado local do
            // formulário) sempre que o servidor mudar algo — evita salvar um dos dois
            // formulários da linha (valor/painel vs. agenda) sobrescrevendo o outro
            // com dado obsoleto que ficou preso no useState desde o primeiro mount.
            <ActivityRow key={`${activity.id}-${activity.updatedAt}`} activity={activity} allActivities={allActivities} />
          ))}
        </tbody>
      </table>
    </section>
  );
}
