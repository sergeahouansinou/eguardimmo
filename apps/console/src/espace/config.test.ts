import { describe, expect, it } from 'vitest';
import { navigation, searchPagesFor } from './config';
import type { OperatorRole } from '@/platform/roles';

const ids = (roles: readonly OperatorRole[] | undefined) => {
  const nav = navigation(undefined, { roles });
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
    expect(navigation(undefined, { roles: [] }).sections).toEqual([]);
    expect(navigation(undefined, { roles: ['billing'] }).sections.map((section) => section.id)).toEqual(['exploitation', 'gouvernance']);
  });

  it('réserve Modules aux rôles qui lisent les plans, et montre tout sans rôle connu', () => {
    expect(ids(['admin'])).toContain('modules');
    expect(ids(['billing'])).toContain('modules');
    expect(ids(['support'])).not.toContain('modules');
    expect(ids(['compliance'])).not.toContain('modules');
    expect(ids(undefined)).toContain('modules');
    expect(ids(undefined)).toContain('approbations');
  });

  it('ne propose en mode api que des pages de recherche servies par un écran réel', () => {
    const hrefs = searchPagesFor(true).map((page) => page.href);

    expect(hrefs).toContain('/modules');
    expect(hrefs).toContain('/organisations');
    for (const gated of ['/organisations/nouvelle', '/abonnements/plans/nouveau', '/sauvegardes/restauration', '/notifications', '/parametres/notifications', '/equipe/inviter']) {
      expect(hrefs).not.toContain(gated);
    }
    expect(searchPagesFor(false).map((page) => page.href)).toContain('/organisations/nouvelle');
  });

  it('réserve la section Communication à l’administrateur', () => {
    const section = navigation(undefined, { roles: ['admin'] }).sections.find((candidate) => candidate.id === 'communication');

    expect(section?.label).toBe('Communication');
    expect(section?.entries.map((entry) => [entry.label, entry.href])).toEqual([
      ['Marketing', '/marketing'],
      ['Notifications et rappels', '/rappels'],
    ]);
    for (const role of ['support', 'compliance', 'billing', 'engineering'] as const) {
      expect(ids([role])).not.toContain('marketing');
      expect(ids([role])).not.toContain('rappels');
    }
  });

  it('propose les pages de communication dans la recherche', () => {
    for (const api of [true, false]) {
      expect(searchPagesFor(api).map((page) => page.href)).toEqual(expect.arrayContaining(['/marketing', '/marketing/nouvelle', '/rappels', ...(api ? [] : ['/notifications'])]));
    }
  });

  it('porte le compteur d’approbations en attente', () => {
    const entry = navigation({ approbations: 3 }, { roles: ['admin'] }).sections.flatMap((section) => section.entries).find((candidate) => candidate.id === 'approbations');
    expect(entry).toMatchObject({ href: '/approbations', count: 3 });
  });
});
