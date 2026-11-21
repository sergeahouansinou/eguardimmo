import { describe, expect, it } from 'vitest';
import { EMPTY_OVERRIDE, validateOverride } from './overrideForm';
import type { OverrideDraft } from './overrideForm';

const NOW = new Date('2026-11-21T09:00:00+00:00');
const QUOTAS = new Set(['users']);
const valid: OverrideDraft = { ...EMPTY_OVERRIDE, feature: 'banking', enabled: 'true', endsAt: '2027-02-01', reasonCode: 'pilot' };

describe('formulaire de dérogation de droits', () => {
  it('construit une charge utile faite uniquement de chaînes', () => {
    expect(validateOverride(valid, QUOTAS, NOW)).toEqual({ ok: true, payload: { feature: 'banking', enabled: 'true', ends_at: '2027-02-01', reason_code: 'pilot' } });
  });

  it('transmet la limite d’un quota, et seulement d’un quota', () => {
    const quota = validateOverride({ ...valid, feature: 'users', limit: '25' }, QUOTAS, NOW);
    expect(quota).toEqual({ ok: true, payload: { feature: 'users', enabled: 'true', ends_at: '2027-02-01', reason_code: 'pilot', limit_value: '25' } });

    const fonction = validateOverride({ ...valid, limit: '25' }, QUOTAS, NOW);
    expect(fonction.ok && 'limit_value' in fonction.payload).toBe(false);
  });

  it('refuse une limite qui n’est pas un entier positif', () => {
    for (const limit of ['-1', '2,5', 'abc', '1e3']) {
      const result = validateOverride({ ...valid, feature: 'users', limit }, QUOTAS, NOW);
      expect(result.ok, limit).toBe(false);
      if (!result.ok) expect(result.errors.limit).toBeTruthy();
    }
  });

  it('refuse une date passée, au-delà de 366 jours, absente ou mal formée', () => {
    for (const endsAt of ['2026-11-20', '2027-11-23', '2027-12-01', '', 'demain']) {
      const result = validateOverride({ ...valid, endsAt }, QUOTAS, NOW);
      expect(result.ok, endsAt).toBe(false);
      if (!result.ok) expect(result.errors.endsAt).toBeTruthy();
    }
  });

  it('accepte les bornes du serveur : fin le jour même et à 366 jours', () => {
    expect(validateOverride({ ...valid, endsAt: '2026-11-21' }, QUOTAS, NOW).ok).toBe(true);
    expect(validateOverride({ ...valid, endsAt: '2027-11-22' }, QUOTAS, NOW).ok).toBe(true);
  });

  it('exige une fonction et un motif de la liste fermée', () => {
    const result = validateOverride({ ...valid, feature: '', reasonCode: 'unpaid' }, QUOTAS, NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(['feature', 'reasonCode']);
  });
});
