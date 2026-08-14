import { periodStartUtc, nextPeriodStartUtc } from './period.util';

function utc(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

describe('periodStartUtc', () => {
  describe('WEEKLY', () => {
    // Semana de referência: segunda 2026-08-10 até domingo 2026-08-16.
    it('retorna a própria data quando já é segunda-feira', () => {
      expect(periodStartUtc('WEEKLY', utc('2026-08-10'))).toEqual(utc('2026-08-10'));
    });

    it('retorna a segunda-feira da mesma semana pra um dia no meio (quinta)', () => {
      expect(periodStartUtc('WEEKLY', utc('2026-08-13'))).toEqual(utc('2026-08-10'));
    });

    it('retorna a segunda-feira da mesma semana pro domingo (último dia)', () => {
      expect(periodStartUtc('WEEKLY', utc('2026-08-16'))).toEqual(utc('2026-08-10'));
    });

    it('atravessa virada de mês corretamente (domingo 1º de março cai na semana de 23/02)', () => {
      expect(periodStartUtc('WEEKLY', utc('2026-03-01'))).toEqual(utc('2026-02-23'));
    });

    it('atravessa virada de ano corretamente (1º de janeiro cai na semana de 29/12 do ano anterior)', () => {
      expect(periodStartUtc('WEEKLY', utc('2026-01-01'))).toEqual(utc('2025-12-29'));
    });
  });

  describe('MONTHLY', () => {
    it('retorna o dia 1º do mês, independente do dia de entrada', () => {
      expect(periodStartUtc('MONTHLY', utc('2026-08-13'))).toEqual(utc('2026-08-01'));
      expect(periodStartUtc('MONTHLY', utc('2026-08-31'))).toEqual(utc('2026-08-01'));
    });
  });
});

describe('nextPeriodStartUtc', () => {
  it('WEEKLY: avança exatamente 7 dias', () => {
    expect(nextPeriodStartUtc('WEEKLY', utc('2026-08-10'))).toEqual(utc('2026-08-17'));
  });

  it('WEEKLY: avança 7 dias mesmo atravessando virada de mês', () => {
    expect(nextPeriodStartUtc('WEEKLY', utc('2026-02-23'))).toEqual(utc('2026-03-02'));
  });

  it('MONTHLY: avança pro dia 1º do mês seguinte', () => {
    expect(nextPeriodStartUtc('MONTHLY', utc('2026-08-01'))).toEqual(utc('2026-09-01'));
  });

  it('MONTHLY: avança corretamente na virada de ano (dezembro -> janeiro)', () => {
    expect(nextPeriodStartUtc('MONTHLY', utc('2025-12-01'))).toEqual(utc('2026-01-01'));
  });
});
