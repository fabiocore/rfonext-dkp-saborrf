import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createActivity,
  fetchActivities,
  fetchCharacters,
  fetchGuildSettings,
  recordManualEvent,
  updateActivity,
  type Activity,
} from '../../api/client';
import { ImageUploadInput } from '../../components/ImageUploadInput';
import { CalendarIcon } from '../../components/CalendarIcon';
import { ScheduleEditor, WEEKDAY_LABELS } from './ActivitiesPage';
import { formatRecurringSchedule, localDatetimeInputToUtcIso, localWeekdaysAndTimeToUtc } from '../../utils/scheduleTimezone';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/** Formata uma data-só (ex: "2026-08-11") sem reinterpretar pelo fuso do navegador — meia-noite UTC não deve "voltar" um dia pra quem está em fuso negativo. */
function formatDateOnly(isoDate: string): string {
  const [year, month, day] = isoDate.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

function CreateEventForm({ currencyAbbr }: { currencyAbbr: string }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [brcValue, setBrcValue] = useState(0);
  const [scheduleType, setScheduleType] = useState<Activity['scheduleType']>('NONE');
  const [scheduleOneTimeAt, setScheduleOneTimeAt] = useState('');
  const [weekdaysLocal, setWeekdaysLocal] = useState<Set<number>>(new Set());
  const [timeLocal, setTimeLocal] = useState('20:00');
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => {
      const { weekdaysUtc, timeUtcMinutes } =
        scheduleType === 'RECURRING' && weekdaysLocal.size > 0
          ? localWeekdaysAndTimeToUtc(Array.from(weekdaysLocal), timeLocal)
          : { weekdaysUtc: [], timeUtcMinutes: null as number | null };
      return createActivity({
        name,
        brcValue,
        showOnEventsPanel: true,
        scheduleType,
        scheduleOneTimeAt:
          scheduleType === 'ONE_TIME' && scheduleOneTimeAt ? localDatetimeInputToUtcIso(scheduleOneTimeAt) : undefined,
        scheduleWeekdaysUtc: scheduleType === 'RECURRING' ? weekdaysUtc : [],
        scheduleTimeUtcMinutes: scheduleType === 'RECURRING' ? timeUtcMinutes ?? undefined : undefined,
        imageUrl: imageUrl ?? undefined,
      });
    },
    onSuccess: () => {
      setName('');
      setBrcValue(0);
      setScheduleType('NONE');
      setScheduleOneTimeAt('');
      setWeekdaysLocal(new Set());
      setTimeLocal('20:00');
      setImageUrl(null);
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

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    mutation.mutate();
  }

  return (
    <form className="settings-form" onSubmit={handleSubmit}>
      <label>
        Nome do evento
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder='ex: "Guerra de Guild"' required />
      </label>
      <label>
        Valor sugerido ({currencyAbbr} por participante)
        <input type="number" min={0} value={brcValue} onChange={(e) => setBrcValue(Number(e.target.value))} style={{ width: 90 }} />
      </label>
      <label>
        Agenda
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
      <button type="submit" disabled={mutation.isPending || !name.trim()}>
        Publicar evento
      </button>
    </form>
  );
}

function scheduleSummary(event: Activity, locale: string): string {
  if (event.scheduleType === 'ONE_TIME' && event.scheduleOneTimeAt) {
    return new Date(event.scheduleOneTimeAt).toLocaleString(locale, {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  if (event.scheduleType === 'RECURRING' && event.scheduleTimeUtcMinutes !== null) {
    return formatRecurringSchedule(event.scheduleWeekdaysUtc, event.scheduleTimeUtcMinutes, locale);
  }
  return 'Sem agenda fixa';
}

function DistributeForm({
  event,
  onDone,
  currencyAbbr,
}: {
  event: Activity;
  onDone: () => void;
  currencyAbbr: string;
}) {
  const queryClient = useQueryClient();
  const charactersQuery = useQuery({ queryKey: ['characters'], queryFn: fetchCharacters });
  const principals = (charactersQuery.data ?? []).filter((c) => c.status === 'PRINCIPAL' && c.membershipStatus === 'ACTIVE');

  const [occurrenceDate, setOccurrenceDate] = useState(todayIso());
  const [brcValueEach, setBrcValueEach] = useState(event.brcValue);
  const [proofImageUrl, setProofImageUrl] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      recordManualEvent({
        activityId: event.id,
        occurrenceDate,
        title: event.name,
        brcValueEach,
        proofImageUrl: proofImageUrl!,
        characterIds: Array.from(selected),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      queryClient.invalidateQueries({ queryKey: ['balances'] });
      queryClient.invalidateQueries({ queryKey: ['public-feed'] });
      queryClient.invalidateQueries({ queryKey: ['public-events'] });
      onDone();
    },
    onError: (err: any) => {
      setError(err?.response?.data?.message ?? `Falha ao distribuir ${currencyAbbr}.`);
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
    setError(null);
    if (!proofImageUrl || selected.size === 0) return;
    mutation.mutate();
  }

  return (
    <form className="settings-form" onSubmit={handleSubmit}>
      <label>
        Data desta ocorrência
        <input type="date" value={occurrenceDate} onChange={(e) => setOccurrenceDate(e.target.value)} required />
      </label>
      <label>
        Valor por participante
        <input type="number" min={1} value={brcValueEach} onChange={(e) => setBrcValueEach(Number(e.target.value))} required />
      </label>
      <label>
        Print de comprovação
        <ImageUploadInput value={proofImageUrl} onChange={setProofImageUrl} required />
      </label>
      <div>
        <p>Participantes ({selected.size} selecionado(s))</p>
        <div className="checkbox-grid">
          {principals.map((c) => (
            <label key={c.id}>
              <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
              {c.gameName}
            </label>
          ))}
        </div>
      </div>
      {error && <p className="form-error">{error}</p>}
      <button type="submit" disabled={mutation.isPending || !proofImageUrl || selected.size === 0}>
        Confirmar distribuição
      </button>
    </form>
  );
}

function EventCard({ event, currencyAbbr }: { event: Activity; currencyAbbr: string }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<'distribute' | 'schedule' | null>(null);

  const closeMutation = useMutation({
    mutationFn: () => updateActivity(event.id, { isActive: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      queryClient.invalidateQueries({ queryKey: ['public-events'] });
    },
  });
  const reopenMutation = useMutation({
    mutationFn: () => updateActivity(event.id, { isActive: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      queryClient.invalidateQueries({ queryKey: ['public-events'] });
    },
  });

  const lastBatch = event.manualEventBatches[0];

  return (
    <div className="auction-item-card">
      {event.imageUrl && (
        <img src={event.imageUrl} alt={event.name} style={{ maxWidth: 200, borderRadius: 8, marginBottom: 8 }} />
      )}
      <h3>
        {event.name}{' '}
        <span className={event.isActive ? 'badge badge-yes' : 'badge badge-no'}>
          {event.isActive ? 'Ativo' : 'Encerrado'}
        </span>
      </h3>
      <p className="subtitle" style={{ marginBottom: 4 }}>
        {scheduleSummary(event, 'pt-BR')} — sugestão: {event.brcValue} {currencyAbbr}
      </p>
      {event.manualEventBatches.length > 0 && (
        <p className="subtitle" style={{ marginBottom: 4 }}>
          {event.manualEventBatches.length} distribuição(ões) registrada(s)
          {lastBatch?.occurrenceDate && ` — última em ${formatDateOnly(lastBatch.occurrenceDate)}`}
        </p>
      )}

      <div>
        {event.isActive && (
          <button type="button" onClick={() => setExpanded(expanded === 'distribute' ? null : 'distribute')}>
            Distribuir {currencyAbbr}
          </button>
        )}{' '}
        <button
          type="button"
          className="icon-btn"
          title="Editar agenda"
          aria-label="Editar agenda"
          onClick={() => setExpanded(expanded === 'schedule' ? null : 'schedule')}
        >
          <CalendarIcon />
        </button>{' '}
        {event.isActive ? (
          <button
            type="button"
            onClick={() => {
              if (confirm(`Encerrar "${event.name}"? Ele some do Painel de Eventos e para de aceitar novas distribuições — dá pra reabrir depois.`)) {
                closeMutation.mutate();
              }
            }}
            disabled={closeMutation.isPending}
          >
            Encerrar evento
          </button>
        ) : (
          <button type="button" onClick={() => reopenMutation.mutate()} disabled={reopenMutation.isPending}>
            Reabrir
          </button>
        )}
      </div>

      {expanded === 'distribute' && (
        <DistributeForm event={event} onDone={() => setExpanded(null)} currencyAbbr={currencyAbbr} />
      )}
      {expanded === 'schedule' && <ScheduleEditor activity={event} />}
    </div>
  );
}

export function CustomEventsPage() {
  const activitiesQuery = useQuery({ queryKey: ['activities'], queryFn: fetchActivities });
  const settingsQuery = useQuery({ queryKey: ['guild-settings'], queryFn: fetchGuildSettings });
  const currencyAbbr = settingsQuery.data?.currencyAbbr ?? 'BRC';
  const customEvents = (activitiesQuery.data ?? []).filter((a) => a.sourceType === 'MANUAL' && !a.isComposite);
  const activeEvents = customEvents.filter((e) => e.isActive);
  const closedEvents = customEvents.filter((e) => !e.isActive);

  return (
    <section>
      <h2>Eventos Personalizados</h2>
      <p className="subtitle">
        Eventos customizados (não vindos do jogo), em duas etapas: publique o evento aqui pra ele aparecer no
        Painel de Eventos da home, e depois que ele acontecer, clique "Distribuir {currencyAbbr}" pra registrar quem
        participou de verdade e creditar o valor, com print de comprovação. Eventos recorrentes continuam ativos pra
        próxima ocorrência depois de distribuir — use "Encerrar evento" só quando ele não for mais acontecer.
      </p>

      <CreateEventForm currencyAbbr={currencyAbbr} />

      <h3 style={{ marginTop: 24 }}>Ativos</h3>
      {activeEvents.length === 0 && <p>Nenhum evento personalizado ativo.</p>}
      {activeEvents.map((event) => (
        <EventCard key={`${event.id}-${event.updatedAt}`} event={event} currencyAbbr={currencyAbbr} />
      ))}

      {closedEvents.length > 0 && (
        <>
          <h3 style={{ marginTop: 24 }}>Encerrados</h3>
          {closedEvents.map((event) => (
            <EventCard key={`${event.id}-${event.updatedAt}`} event={event} currencyAbbr={currencyAbbr} />
          ))}
        </>
      )}
    </section>
  );
}
