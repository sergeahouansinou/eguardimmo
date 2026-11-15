import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  addMonthsClamped,
  diffDays,
  formatDayMonthShort,
  formatFrDate,
  formatMonthTitle,
  isValidIsoDate,
  monthWeeks,
  weekdayIndex,
} from './dates';

describe('dates', () => {
  it('calcule les écarts et décalages en jours', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-11-13', -13)).toBe('2026-10-31');
    expect(diffDays('2026-11-10', '2026-11-13')).toBe(3);
    expect(diffDays('2026-11-13', '2026-11-12')).toBe(-1);
  });

  it('décale les mois en conservant le jour quand il existe', () => {
    expect(addMonths('2026-11', 1)).toBe('2026-12');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonthsClamped('2026-01-31', 1)).toBe('2026-02-28');
  });

  it('construit la grille de novembre 2026, du lundi 26 octobre au dimanche 6 décembre', () => {
    const weeks = monthWeeks('2026-11');
    expect(weeks).toHaveLength(6);
    expect(weeks[0]?.[0]).toBe('2026-10-26');
    expect(weeks[0]?.[6]).toBe('2026-11-01');
    expect(weeks[5]?.[0]).toBe('2026-11-30');
    expect(weeks[5]?.[6]).toBe('2026-12-06');
    expect(weekdayIndex('2026-11-13')).toBe(4);
  });

  it('formate à la française et valide les dates ISO', () => {
    expect(formatFrDate('2026-11-05')).toBe('05/11/2026');
    expect(formatDayMonthShort('2026-11-05')).toBe('05/11');
    expect(formatMonthTitle('2026-11')).toBe('Novembre 2026');
    expect(isValidIsoDate('2026-02-30')).toBe(false);
    expect(isValidIsoDate('13/11/2026')).toBe(false);
    expect(isValidIsoDate('2026-11-13')).toBe(true);
  });
});
