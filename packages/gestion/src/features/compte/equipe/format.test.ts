import { describe, expect, it } from 'vitest';
import { lastLoginLabel } from './format';
import type { Member } from './schemas';

const member = (lastLogin: string | null, online = false): Member => ({
  id: 'm1',
  firstName: 'Awa',
  lastName: 'Diallo',
  email: 'awa.diallo@example.com',
  role: 'titulaire',
  scope: { type: 'all' },
  twoFactor: 'activee',
  lastLogin,
  online,
  status: 'actif',
  self: true,
});

describe('dernière connexion', () => {
  it('compare au jour fourni et non à une date de démonstration', () => {
    expect(lastLoginLabel(member('2026-12-24T09:15:00+00:00'), '2026-12-24')).toMatch(/^Aujourd'hui, /);
    expect(lastLoginLabel(member('2026-12-24T09:15:00+00:00'), '2026-11-13')).not.toMatch(/^Aujourd'hui/);
  });

  it('distingue en ligne et jamais connecté', () => {
    expect(lastLoginLabel(member(null, true), '2026-12-24')).toBe('En ligne');
    expect(lastLoginLabel(member(null), '2026-12-24')).toBe('Jamais');
  });
});
