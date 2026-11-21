import { describe, expect, it } from 'vitest';
import { buildLookup } from './lookup';

describe('construction de la recherche de compte', () => {
  it('accepte une adresse complète, rognée', () => {
    expect(buildLookup('email', '  jeanne@exemple.fr ')).toEqual({ ok: true, lookup: { email: 'jeanne@exemple.fr' } });
  });

  it('refuse une adresse vide, sans arobase, avec espace ou trop longue', () => {
    for (const value of ['', '   ', 'jeanne', 'jeanne@', 'a b@exemple.fr', `${'a'.repeat(250)}@x.fr`]) {
      expect(buildLookup('email', value).ok, value).toBe(false);
    }
  });

  it('accepte un identifiant sans espace', () => {
    expect(buildLookup('id', ' 01934f6e-eeee-7000-8000-000000000001 ')).toEqual({ ok: true, lookup: { id: '01934f6e-eeee-7000-8000-000000000001' } });
  });

  it('refuse un identifiant vide, avec espace ou trop long', () => {
    for (const value of ['', 'abc def', 'a'.repeat(65)]) expect(buildLookup('id', value).ok, value).toBe(false);
  });
});
