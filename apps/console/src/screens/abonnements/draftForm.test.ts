import { describe, expect, it } from 'vitest';
import { toPlanVersion } from '@/platform/plans/plans';
import { draftVersion, versionData } from '@/platform/plans/planFixtures';
import { buildChanges, toDraftState } from './draftForm';
import { formatMinor, parseLimit, parseMajor } from './money';

type RawVersion = Parameters<typeof toPlanVersion>[0];
const version = () => toPlanVersion(draftVersion() as RawVersion);

describe('montants', () => {
  it('formate les unités mineures sans flottant, avec ou sans centimes', () => {
    expect(formatMinor(3500, 'EUR')).toBe('35 €');
    expect(formatMinor(3550, 'EUR')).toBe('35,50 €');
    expect(formatMinor(4905, 'CAD')).toBe('49,05 CA$');
    expect(formatMinor(1234500, 'EUR')).toMatch(/^12\s?345 €$/);
  });

  it('convertit la saisie en unités mineures', () => {
    expect(parseMajor('35')).toBe(3500);
    expect(parseMajor('35,50')).toBe(3550);
    expect(parseMajor('abc')).toBeNull();
  });

  it('distingue illimité (vide), nombre et saisie invalide', () => {
    expect(parseLimit('')).toBeNull();
    expect(parseLimit('  ')).toBeNull();
    expect(parseLimit('150')).toBe(150);
    expect(parseLimit('-3')).toBeUndefined();
    expect(parseLimit('1,5')).toBeUndefined();
    expect(parseLimit('1234567890')).toBeUndefined();
  });
});

describe('brouillon de version', () => {
  it('reprend la version : une ligne par devise, prix absent laissé vide', () => {
    const state = toDraftState(version());

    expect(state.prices).toEqual([
      { currency: 'EUR', monthly: '39', yearly: '390' },
      { currency: 'CAD', monthly: '', yearly: '' },
    ]);
    expect(state.entitlements.find((e) => e.feature === 'leases')).toMatchObject({ enabled: true, limit: '200' });
  });

  it('n’envoie la limite que d’un quota activé, null pour une fonction ou un quota désactivé', () => {
    const state = toDraftState(version());
    const built = buildChanges({
      ...state,
      entitlements: state.entitlements.map((e) => (e.feature === 'storage_mb' ? { ...e, enabled: false } : e)),
    });

    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.changes.entitlements.find((e) => e.feature === 'leases')).toEqual({ feature: 'leases', enabled: true, limit: 200 });
    expect(built.changes.entitlements.find((e) => e.feature === 'storage_mb')).toEqual({ feature: 'storage_mb', enabled: false, limit: null });
    expect(built.changes.entitlements.find((e) => e.feature === 'rent')).toEqual({ feature: 'rent', enabled: true, limit: null });
  });

  it('omet une devise laissée vide et refuse une devise à moitié remplie', () => {
    const state = toDraftState(version());
    const half = buildChanges({ ...state, prices: state.prices.map((p) => (p.currency === 'CAD' ? { ...p, monthly: '49' } : p)) });

    expect(half.ok).toBe(false);
    if (!half.ok) expect(half.errors.prices.CAD).toBeDefined();
    const whole = buildChanges(state);
    expect(whole.ok && whole.changes.prices).toEqual([{ currency: 'EUR', monthlyAmount: 3900, yearlyAmount: 39000 }]);
  });

  it('ne perd pas l’inscription publique d’une version publiée utilisée comme base', () => {
    const published = toPlanVersion(versionData() as RawVersion);

    expect(toDraftState(published).publicSignup).toBe(true);
  });
});
