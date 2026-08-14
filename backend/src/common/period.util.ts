/**
 * Início (00:00 UTC) do período civil (semana ou mês) que contém `date` —
 * usado pra agrupar atividades WEEKLY/MONTHLY. `date` é sempre um
 * referenceDate (data-só, meia-noite UTC), então o corte é por dia
 * calendário, não pelo horário exato das 07h GMT-3 do reset real do jogo
 * (o dado de origem não tem granularidade de hora pra ser mais preciso).
 * Semana = segunda a domingo. Mês = dia 1º ao último dia do mês.
 *
 * Extraído de LedgerService pra backend/src/common em 2026-08-14, pra
 * reaproveitar a mesma regra em AuctionsService (busca de participantes
 * recentes por atividade semanal) sem duplicar a matemática de calendário.
 */
export function periodStartUtc(period: 'WEEKLY' | 'MONTHLY', date: Date): Date {
  if (period === 'MONTHLY') {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  }
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay(); // 0=domingo..6=sábado
  const diffToMonday = (day + 6) % 7; // segunda=0, terça=1, ..., domingo=6
  d.setUTCDate(d.getUTCDate() - diffToMonday);
  return d;
}

/** Início (00:00 UTC) do período civil SEGUINTE a `periodStart` — fim exclusivo do range. */
export function nextPeriodStartUtc(period: 'WEEKLY' | 'MONTHLY', periodStart: Date): Date {
  const d = new Date(periodStart);
  if (period === 'MONTHLY') {
    d.setUTCMonth(d.getUTCMonth() + 1);
  } else {
    d.setUTCDate(d.getUTCDate() + 7);
  }
  return d;
}
