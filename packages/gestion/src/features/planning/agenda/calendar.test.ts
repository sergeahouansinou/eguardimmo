import { describe, expect, it } from 'vitest';
import { MAX_RANGE_DAYS } from '../model';
import { addDaysIso, addMonthsIso, daysBetweenIso, isIsoDate, isRangeAllowed, periodLabel, rangeDays, shiftAnchor, startOfWeek, viewRange } from './calendar';

describe('calendrier', () => {
  it('la grille du mois commence le lundi et finit après le dimanche suivant le dernier jour', () => {
    expect(viewRange('mois', '2026-11-15')).toEqual({ from: '2026-10-26', to: '2026-12-07' });
    expect(viewRange('mois', '2027-02-10')).toEqual({ from: '2027-02-01', to: '2027-03-01' });
  });

  it('la semaine va du lundi au lundi suivant (exclu) et le jour dure un jour', () => {
    expect(viewRange('semaine', '2026-11-21')).toEqual({ from: '2026-11-16', to: '2026-11-23' });
    expect(viewRange('jour', '2026-11-21')).toEqual({ from: '2026-11-21', to: '2026-11-22' });
  });

  it('chaque mois de 2026 à 2028 reste dans la fenêtre serveur de 62 jours', () => {
    for (let month = 0; month < 36; month += 1) {
      const anchor = addMonthsIso('2026-01-01', month);
      const range = viewRange('mois', anchor);
      expect(isRangeAllowed(range), anchor).toBe(true);
      expect(rangeDays(range).length % 7, anchor).toBe(0);
    }
  });

  it('refuse une période de 63 jours et accepte 62', () => {
    expect(isRangeAllowed({ from: '2026-01-01', to: addDaysIso('2026-01-01', MAX_RANGE_DAYS) })).toBe(true);
    expect(isRangeAllowed({ from: '2026-01-01', to: addDaysIso('2026-01-01', MAX_RANGE_DAYS + 1) })).toBe(false);
    expect(isRangeAllowed({ from: '2026-01-01', to: '2026-01-01' })).toBe(false);
  });

  it('les jours restent consécutifs à travers les changements d’heure', () => {
    for (const from of ['2026-03-23', '2026-10-19']) {
      const days = rangeDays({ from, to: addDaysIso(from, 14) });
      expect(days).toHaveLength(14);
      expect(new Set(days).size).toBe(14);
      days.slice(1).forEach((day, index) => { expect(daysBetweenIso(days[index] ?? '', day)).toBe(1); });
    }
    expect(rangeDays({ from: '2026-03-28', to: '2026-03-31' })).toEqual(['2026-03-28', '2026-03-29', '2026-03-30']);
    expect(rangeDays({ from: '2026-10-24', to: '2026-10-27' })).toEqual(['2026-10-24', '2026-10-25', '2026-10-26']);
  });

  it('navigue par mois sans déborder sur le mois suivant', () => {
    expect(shiftAnchor('mois', '2026-01-31', 1)).toBe('2026-02-01');
    expect(shiftAnchor('mois', '2026-01-15', -1)).toBe('2025-12-01');
    expect(shiftAnchor('semaine', '2026-11-21', 1)).toBe('2026-11-28');
    expect(shiftAnchor('jour', '2026-12-31', 1)).toBe('2027-01-01');
    expect(addMonthsIso('2026-01-31', 1)).toBe('2026-02-28');
  });

  it('valide les dates ISO', () => {
    expect(isIsoDate('2026-02-28')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('21/11/2026')).toBe(false);
    expect(isIsoDate(null)).toBe(false);
    expect(startOfWeek('2026-11-22')).toBe('2026-11-16');
  });

  it('formate les libellés de période en français', () => {
    expect(periodLabel('mois', '2026-11-15')).toBe('Novembre 2026');
    expect(periodLabel('jour', '2026-11-21')).toBe('Samedi 21 novembre 2026');
    expect(periodLabel('semaine', '2026-11-21')).toBe('Semaine du 16 au 22 novembre 2026');
    expect(periodLabel('semaine', '2026-11-30')).toBe('Semaine du 30 novembre au 6 décembre 2026');
  });
});
