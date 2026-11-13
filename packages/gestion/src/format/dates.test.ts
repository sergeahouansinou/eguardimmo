import { describe, expect, it } from 'vitest';
import { formatDayMonth, formatLongDate, formatMonthLong, formatMonthShort, monthName } from './dates';

describe('dates', () => {
  it('écrit la date longue avec une majuscule', () => {
    expect(formatLongDate('2026-11-13T08:00:00+01:00')).toBe('Vendredi 13 novembre 2026');
  });

  it('écrit jour et mois sur deux chiffres', () => {
    expect(formatDayMonth('2026-12-01')).toBe('01/12');
  });

  it('nomme les mois', () => {
    expect(formatMonthShort('2026-07')).toBe('juil.');
    expect(formatMonthLong('2026-11')).toBe('Novembre 2026');
    expect(monthName('2026-11-13T08:00:00+01:00')).toBe('novembre');
  });

  it('refuse une date invalide', () => {
    expect(() => formatDayMonth('pas-une-date')).toThrow(RangeError);
  });
});
