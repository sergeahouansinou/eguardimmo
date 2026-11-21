import { describe, expect, it } from 'vitest';
import { reportingPermissions } from './permissions';

describe('droits sur les comptes rendus', () => {
  it.each([
    ['owner', { cards: true, agency: true, publish: true, export: true }],
    ['admin', { cards: true, agency: true, publish: true, export: true }],
    ['manager', { cards: true, agency: true, publish: true, export: false }],
    ['accountant', { cards: true, agency: true, publish: false, export: true }],
  ] as const)('%s en agence', (role, expected) => {
    expect(reportingPermissions(role, 'agency')).toEqual(expected);
  });

  it('un bailleur autonome n’a que les cartes', () => {
    for (const role of ['owner', 'admin', 'manager', 'accountant'] as const) {
      expect(reportingPermissions(role, 'individual')).toEqual({ cards: true, agency: false, publish: false, export: false });
    }
  });

  it('sans rôle ou sans type d’organisation, rien n’est permis', () => {
    const none = { cards: false, agency: false, publish: false, export: false };
    expect(reportingPermissions(null, 'agency')).toEqual(none);
    expect(reportingPermissions('owner', null)).toEqual(none);
  });
});
