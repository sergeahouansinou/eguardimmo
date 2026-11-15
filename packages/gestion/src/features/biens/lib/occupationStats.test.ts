import { describe, expect, it } from 'vitest';
import { occupationStats } from './occupationStats';
import type { Period } from '../schemas/lots';

const period = (id: string, kind: Period['kind'], startDate: string, endDate: string | null, occupant: string | null): Period => ({
  id, kind, startDate, endDate, occupant: occupant ? { id: occupant, name: occupant } : null, leaseType: null, note: null,
  status: kind === 'bail' ? (endDate ? 'termine' : 'en_cours') : null, noticeEndsOn: null, entryRent: null, lastRent: null, deposit: null, exitNote: null,
});

describe('statistiques d’occupation', () => {
  it('calcule locataires, durée moyenne, vacance et évolution du loyer', () => {
    const stats = occupationStats({
      asOf: '2026-11-13',
      periods: [
        period('a', 'bail', '2016-09-01', '2019-12-31', 'julien'),
        period('v', 'vacance', '2020-01-01', '2020-01-14', null),
        period('b', 'bail', '2020-01-15', '2023-03-15', 'sarah'),
        period('c', 'bail', '2023-04-01', null, 'koffi'),
      ],
      rentSteps: [{ year: 2017, rent: 69000, event: null }, { year: 2026, rent: 77000, event: null }],
    });
    expect(stats.tenants).toBe(3);
    expect(stats.leases).toBe(3);
    expect(stats.averageLease).toBe('3 ans 3 mois');
    expect(stats.vacancy).toBe('13 jours');
    expect(stats.rentChange).toEqual({ percent: 11.6, since: 2017 });
    expect(stats.rate).toBeGreaterThan(95);
  });

  it('gère un bien jamais loué', () => {
    const stats = occupationStats({ asOf: '2026-11-13', periods: [], rentSteps: [] });
    expect(stats).toMatchObject({ tenants: 0, leases: 0, averageLease: null, rate: 0, rentChange: null });
  });
});
