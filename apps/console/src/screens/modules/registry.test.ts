import { describe, expect, it } from 'vitest';
import type { Plan, PlanVersion } from '@/platform/plans/plans';
import { buildRegistry, filterRegistry, includedIn, limitText } from './registry';

const entitlement = (feature: string, label: string, group: string, kind: 'quota' | 'function', enabled: boolean, limit: number | null) => ({ feature, label, group, kind, enabled, limit });

const version = (number: number, status: PlanVersion['status'], entitlements: PlanVersion['entitlements']): PlanVersion => ({
  id: `v${String(number)}${status}`,
  version: number,
  status,
  trialDays: 15,
  publicSignup: true,
  publishedAt: null,
  archivedAt: null,
  prices: [],
  entitlements,
});

const plan = (code: string, versions: PlanVersion[]): Plan => ({ id: code, code, name: code.toUpperCase(), versions });

const gold = plan('gold', [
  version(3, 'draft', [entitlement('reporting', 'Comptes rendus', 'pilotage', 'function', true, null)]),
  version(2, 'published', [entitlement('properties', 'Lots', 'socle', 'quota', true, 200), entitlement('reporting', 'Comptes rendus', 'pilotage', 'function', false, null)]),
  version(1, 'published', [entitlement('properties', 'Lots', 'socle', 'quota', true, 10)]),
]);
const silver = plan('silver', [version(1, 'published', [entitlement('properties', 'Lots', 'socle', 'quota', true, null), entitlement('mandates', 'Mandats', 'gestion', 'function', true, null)])]);
const draftOnly = plan('bronze', [version(1, 'draft', [entitlement('rent', 'Loyers', 'socle', 'function', true, null)])]);

describe('registre des fonctions', () => {
  it('ne retient que la dernière version publiée de chaque plan', () => {
    const registry = buildRegistry([gold, silver, draftOnly]);

    const lots = registry.find((row) => row.feature === 'properties');
    expect(lots?.plans).toEqual([
      { code: 'gold', name: 'GOLD', version: 2, enabled: true, limit: 200 },
      { code: 'silver', name: 'SILVER', version: 1, enabled: true, limit: null },
    ]);
    expect(registry.some((row) => row.feature === 'rent')).toBe(false);
  });

  it('compte une fonction absente d’un plan publié comme non incluse dans ce plan', () => {
    const mandates = buildRegistry([gold, silver]).find((row) => row.feature === 'mandates');

    expect(mandates?.plans).toEqual([
      { code: 'gold', name: 'GOLD', version: 2, enabled: false, limit: null },
      { code: 'silver', name: 'SILVER', version: 1, enabled: true, limit: null },
    ]);
  });

  it('trie par groupe puis par libellé', () => {
    expect(buildRegistry([gold, silver]).map((row) => row.feature)).toEqual(['properties', 'mandates', 'reporting']);
  });

  it('reste vide sans version publiée', () => {
    expect(buildRegistry([])).toEqual([]);
    expect(buildRegistry([draftOnly])).toEqual([]);
  });

  it('distingue les plans qui incluent la fonction', () => {
    const reporting = buildRegistry([gold, silver]).find((row) => row.feature === 'reporting');
    expect(reporting && includedIn(reporting)).toEqual([]);
    const mandates = buildRegistry([gold, silver]).find((row) => row.feature === 'mandates');
    expect(mandates && includedIn(mandates).map((p) => p.code)).toEqual(['silver']);
  });

  it('filtre par groupe et par texte, sans tenir compte de la casse', () => {
    const registry = buildRegistry([gold, silver]);

    expect(filterRegistry(registry, { group: 'gestion', search: '' }).map((row) => row.feature)).toEqual(['mandates']);
    expect(filterRegistry(registry, { group: '', search: ' LOTS ' }).map((row) => row.feature)).toEqual(['properties']);
    expect(filterRegistry(registry, { group: 'socle', search: 'mandat' })).toEqual([]);
  });

  it('formule la limite d’un quota', () => {
    expect(limitText({ code: 'a', name: 'A', version: 1, enabled: false, limit: 5 })).toBe('—');
    expect(limitText({ code: 'a', name: 'A', version: 1, enabled: true, limit: null })).toBe('Illimité');
    expect(limitText({ code: 'a', name: 'A', version: 1, enabled: true, limit: 5 })).toBe('5');
  });
});
