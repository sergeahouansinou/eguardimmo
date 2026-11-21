import { describe, expect, it } from 'vitest';
import { filterFormSchema, rangeIssue, subjectIssue, toFormValues } from './filters';
import { EMPTY_FILTERS } from './model';

const values = { from: '', to: '', actor: '', type: '', subjectType: '', subjectId: '' };

describe('filtres du journal', () => {
  it('convertit la fin incluse en borne exclusive et inversement', () => {
    const parsed = filterFormSchema.parse({ ...values, from: '2026-02-27', to: '2026-02-28' });
    expect(parsed).toEqual({ ...EMPTY_FILTERS, from: '2026-02-27', to: '2026-03-01' });
    expect(toFormValues(parsed)).toMatchObject({ from: '2026-02-27', to: '2026-02-28' });
  });

  it('ignore un type inconnu et vide les champs blancs', () => {
    expect(filterFormSchema.parse({ ...values, type: 'nimporte', actor: '  ' })).toEqual(EMPTY_FILTERS);
  });

  it('borne la période à 366 jours, début à partir de 2000, dates calendaires', () => {
    expect(rangeIssue('2025-01-01', '2026-01-02')).toBeNull();
    expect(rangeIssue('2025-01-01', '2026-01-03')).toBe('La période ne peut pas dépasser 366 jours.');
    expect(rangeIssue('1999-12-31', null)).toMatch(/2000/);
    expect(rangeIssue('2026-02-30', null)).toMatch(/valide/);
    expect(rangeIssue('2026-03-01', '2026-03-01')).toMatch(/postérieure/);
  });

  it('exige type et identifiant d’élément ensemble', () => {
    expect(subjectIssue('lease', null)).not.toBeNull();
    expect(subjectIssue(null, null)).toBeNull();
    expect(filterFormSchema.safeParse({ ...values, subjectId: '0198c000-0000-7000-8000-000000000001' }).success).toBe(false);
  });
});
