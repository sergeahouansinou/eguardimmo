import { describe, expect, it } from 'vitest';
import { navigation } from './config';
import type { OperatorRole } from '@/platform/roles';

const ids = (roles: readonly OperatorRole[] | undefined, api = true) => {
  const nav = navigation(undefined, { roles, api });
  return [...nav.sections.flatMap((section) => section.entries), ...nav.footer].map((entry) => entry.id);
};

describe('navigation filtrée par rôle', () => {
  it('ne propose à un rôle d’ingénierie que la santé, les sauvegardes et les paramètres', () => {
    expect(ids(['engineering']).sort()).toEqual(['parametres', 'sante', 'sauvegardes']);
  });

  it('réserve l’équipe à l’administrateur et les abonnements à admin et facturation', () => {
    expect(ids(['support'])).not.toContain('equipe');
    expect(ids(['support'])).not.toContain('abonnements');
    expect(ids(['billing'])).toContain('abonnements');
    expect(ids(['admin'])).toContain('equipe');
  });

  it('retire les sections vides et n’affiche rien tant que les rôles chargent', () => {
    expect(navigation(undefined, { roles: [], api: true }).sections).toEqual([]);
    expect(navigation(undefined, { roles: ['billing'], api: true }).sections.map((section) => section.id)).toEqual(['exploitation', 'gouvernance']);
  });

  it('masque Modules en mode api seulement, et montre tout sans rôle connu', () => {
    expect(ids(['admin'], true)).not.toContain('modules');
    expect(ids(undefined, false)).toContain('modules');
    expect(ids(undefined, true)).toContain('approbations');
  });

  it('porte le compteur d’approbations en attente', () => {
    const entry = navigation({ approbations: 3 }, { roles: ['admin'], api: true }).sections.flatMap((section) => section.entries).find((candidate) => candidate.id === 'approbations');
    expect(entry).toMatchObject({ href: '/approbations', count: 3 });
  });
});
