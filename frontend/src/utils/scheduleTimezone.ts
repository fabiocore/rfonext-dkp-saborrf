// Converte agenda semanal recorrente entre o fuso do navegador (quem cadastra
// ou quem visualiza) e UTC (o que fica salvo no banco). Convenção de dia da
// semana: 0=domingo .. 6=sábado, igual GuildSettings.weeklyTaxWeekday.
//
// Limitação conhecida: a conversão usa uma semana de referência fixa: se o
// horário for cadastrado num período do ano com deslocamento de horário de
// verão diferente da data real do evento, pode haver 1h de diferença. Pra um
// calendário de guild isso é aceitável — um calendário com consciência plena
// de fuso horário (IANA) seria bem mais complexo.

const REFERENCE_SUNDAY = { year: 2024, month: 0, date: 7 }; // 2024-01-07 é um domingo

export function localWeekdaysAndTimeToUtc(
  weekdaysLocal: number[],
  timeLocal: string, // "HH:mm"
): { weekdaysUtc: number[]; timeUtcMinutes: number } {
  const [hours, minutes] = timeLocal.split(':').map(Number);
  const weekdaysUtcSet = new Set<number>();
  let timeUtcMinutes = 0;

  for (const weekday of weekdaysLocal) {
    const local = new Date(
      REFERENCE_SUNDAY.year,
      REFERENCE_SUNDAY.month,
      REFERENCE_SUNDAY.date + weekday,
      hours || 0,
      minutes || 0,
      0,
      0,
    );
    weekdaysUtcSet.add(local.getUTCDay());
    timeUtcMinutes = local.getUTCHours() * 60 + local.getUTCMinutes();
  }

  return { weekdaysUtc: Array.from(weekdaysUtcSet).sort((a, b) => a - b), timeUtcMinutes };
}

/** Reconstrói um instante (Date) a partir de um dia da semana UTC + minutos UTC, pra formatar no fuso de quem estiver vendo. */
export function utcWeekdayAndTimeToLocalDate(weekdayUtc: number, timeUtcMinutes: number): Date {
  return new Date(
    Date.UTC(
      REFERENCE_SUNDAY.year,
      REFERENCE_SUNDAY.month,
      REFERENCE_SUNDAY.date + weekdayUtc,
      Math.floor(timeUtcMinutes / 60),
      timeUtcMinutes % 60,
      0,
      0,
    ),
  );
}

/** Caminho inverso — pra pré-preencher o formulário de edição com os dias/horário no fuso de quem está editando agora. */
export function utcWeekdaysAndTimeToLocal(
  weekdaysUtc: number[],
  timeUtcMinutes: number,
): { weekdaysLocal: number[]; timeLocal: string } {
  const weekdaysLocalSet = new Set<number>();
  let timeLocal = '00:00';

  for (const weekday of weekdaysUtc) {
    const d = utcWeekdayAndTimeToLocalDate(weekday, timeUtcMinutes);
    weekdaysLocalSet.add(d.getDay());
    timeLocal = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  return { weekdaysLocal: Array.from(weekdaysLocalSet).sort((a, b) => a - b), timeLocal };
}

/**
 * Próxima ocorrência real (data de verdade, não só o dia da semana
 * abstrato) de um horário recorrente, a partir de "from" (padrão: agora).
 * Usado na home pra "Próximos Eventos".
 */
export function nextOccurrenceOf(weekdayUtc: number, timeUtcMinutes: number, from: Date = new Date()): Date {
  const target = new Date(from);
  target.setUTCHours(Math.floor(timeUtcMinutes / 60), timeUtcMinutes % 60, 0, 0);

  const diff = (weekdayUtc - target.getUTCDay() + 7) % 7;
  target.setUTCDate(target.getUTCDate() + diff);

  if (target.getTime() <= from.getTime()) {
    target.setUTCDate(target.getUTCDate() + 7);
  }

  return target;
}

/**
 * <input type="datetime-local"> devolve uma string SEM fuso (ex:
 * "2026-08-09T21:00") — representa a hora de parede de quem está digitando,
 * no fuso do navegador dela. `new Date(...)` de uma string assim é
 * interpretado como hora LOCAL do ambiente que rodar esse código; como isso
 * roda no navegador, o fuso certo (de quem está cadastrando) é usado. Só
 * depois disso vira UTC de verdade (.toISOString()), pronto pra mandar pro
 * backend — nunca mandar a string crua, porque o container do backend roda
 * em UTC e reinterpretaria "21:00" como 21h UTC, não 21h do fuso de quem
 * cadastrou (bug real encontrado em 2026-08-09: evento marcado 21h BRT
 * aparecia como 18h na home).
 */
export function localDatetimeInputToUtcIso(localDatetime: string): string {
  return new Date(localDatetime).toISOString();
}

/** Caminho inverso — pra reabrir o formulário de edição com a data/hora certas no fuso de quem está editando agora. */
export function utcIsoToLocalDatetimeInput(utcIso: string): string {
  const d = new Date(utcIso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Texto pronto pra exibição, já convertido pro fuso do navegador de quem está vendo (ex: "Segunda, Quarta às 21:00"). */
export function formatRecurringSchedule(weekdaysUtc: number[], timeUtcMinutes: number, locale: string): string {
  if (weekdaysUtc.length === 0) return '';
  const dayNames = weekdaysUtc
    .map((wd) => utcWeekdayAndTimeToLocalDate(wd, timeUtcMinutes))
    .sort((a, b) => a.getDay() - b.getDay())
    .map((d) => d.toLocaleDateString(locale, { weekday: 'long' }));
  const uniqueDayNames = Array.from(new Set(dayNames));
  const time = utcWeekdayAndTimeToLocalDate(weekdaysUtc[0], timeUtcMinutes).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${uniqueDayNames.join(', ')} — ${time}`;
}
