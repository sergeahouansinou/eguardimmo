import { describe, expect, it } from 'vitest';
import { MAX_MONTHS, lastDayOf, monthsBetween, periodFormSchema, periodOf } from './period';

describe('période d’analyse', () => {
  it('accepte exactement 36 mois et refuse 37 mois', () => {
    expect(MAX_MONTHS).toBe(36);
    expect(monthsBetween('2024-01', '2026-12')).toBe(36);
    expect(periodFormSchema.safeParse({ fromMonth: '2024-01', toMonth: '2026-12' }).success).toBe(true);
    const refused = periodFormSchema.safeParse({ fromMonth: '2024-01', toMonth: '2027-01' });
    expect(refused.success).toBe(false);
    expect(refused.error?.issues[0]?.message).toBe('La période ne peut pas dépasser 36 mois.');
  });

  it('refuse un mois de fin antérieur au mois de début', () => {
    expect(periodFormSchema.safeParse({ fromMonth: '2026-05', toMonth: '2026-04' }).error?.issues[0]?.message).toBe('Le mois de fin doit suivre le mois de début.');
  });

  it('borne la période au premier et au dernier jour, février bissextile compris', () => {
    expect(periodOf('2024-02', '2024-02')).toEqual({ from: '2024-02-01', to: '2024-02-29' });
    expect(lastDayOf('2026-02')).toBe('2026-02-28');
  });
});
