import { describe, expect, it } from 'vitest';
import { matchesPeriod } from './periods';

const NOW = new Date('2026-11-13T10:00:00+01:00');

describe('matchesPeriod', () => {
  it('ne filtre rien pour toutes les périodes et laisse passer une date absente', () => {
    expect(matchesPeriod('2019-01-01T09:00:00+01:00', 'all', NOW)).toBe(true);
    expect(matchesPeriod(null, 'month', NOW)).toBe(true);
  });

  it('retient le mois en cours, y compris une date programmée plus tard dans le mois', () => {
    expect(matchesPeriod('2026-11-25T08:00:00+01:00', 'month', NOW)).toBe(true);
    expect(matchesPeriod('2026-10-31T23:30:00Z', 'month', NOW)).toBe(true);
    expect(matchesPeriod('2026-10-02T09:00:00+02:00', 'month', NOW)).toBe(false);
  });

  it('retient les trois derniers mois jusqu’au mois en cours', () => {
    expect(matchesPeriod('2026-09-01T09:00:00+02:00', 'quarter', NOW)).toBe(true);
    expect(matchesPeriod('2026-08-31T09:00:00+02:00', 'quarter', NOW)).toBe(false);
    expect(matchesPeriod('2026-12-02T09:00:00+01:00', 'quarter', NOW)).toBe(false);
  });

  it('retient l’année civile en heure de Paris', () => {
    expect(matchesPeriod('2026-01-01T00:30:00+01:00', 'year', NOW)).toBe(true);
    expect(matchesPeriod('2025-12-31T23:30:00Z', 'year', NOW)).toBe(true);
    expect(matchesPeriod('2025-12-31T22:30:00Z', 'year', NOW)).toBe(false);
  });
});
