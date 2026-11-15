import { describe, expect, it } from 'vitest';
import {
  formatDate,
  formatDateTime,
  formatDayMonthTime,
  formatFileSize,
  localValueToIso,
  toDateTimeLocalValue,
} from './dates';

describe('dates', () => {
  it('formate en heure de Paris', () => {
    expect(formatDate('2026-11-08T09:15:00+01:00')).toBe('08/11/2026');
    expect(formatDateTime('2026-11-08T09:15:00+01:00')).toBe('08/11/2026, 09:15');
    expect(formatDayMonthTime('2026-11-13T07:40:00Z')).toBe('13/11 08:40');
  });

  it('convertit une saisie locale en ISO avec le décalage de Paris (hiver et été)', () => {
    expect(localValueToIso('2026-11-25T08:00')).toBe('2026-11-25T08:00:00+01:00');
    expect(localValueToIso('2026-07-14T10:30')).toBe('2026-07-14T10:30:00+02:00');
  });

  it('retrouve la saisie locale depuis un ISO', () => {
    expect(toDateTimeLocalValue('2026-11-25T08:00:00+01:00')).toBe('2026-11-25T08:00');
    expect(toDateTimeLocalValue(localValueToIso('2026-07-14T10:30'))).toBe('2026-07-14T10:30');
  });

  it('formate les tailles de fichier', () => {
    expect(formatFileSize(512)).toBe('512 o');
    expect(formatFileSize(1_468_006)).toBe('1,4 Mo');
    expect(formatFileSize(20_480)).toBe('20 Ko');
  });
});
