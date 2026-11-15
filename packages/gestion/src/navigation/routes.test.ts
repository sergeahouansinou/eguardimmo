import { describe, expect, it } from 'vitest';
import { buildNavigation, plannedScreens } from './routes';

describe('navigation de gestion', () => {
  it('reprend les trois groupes et le pied du design', () => {
    const navigation = buildNavigation();
    expect(navigation.sections.map((section) => section.label)).toEqual(['Principal', 'Suivi', 'Outils']);
    expect(navigation.sections[0]?.entries.map((entry) => entry.label)).toEqual([
      'Accueil',
      'Biens',
      'Locataires',
      'Baux',
      'Finances',
      'Documents',
    ]);
    expect(navigation.footer.map((entry) => entry.label)).toEqual(['Réglages', 'Équipe']);
  });

  it('affiche les compteurs du compte', () => {
    const navigation = buildNavigation({ lots: 11, tenants: 10, unreadMessages: 2, openInterventions: 3 });
    const counts = navigation.sections.flatMap((section) => section.entries).map((entry) => entry.count ?? null);
    expect(counts.filter((value) => value !== null)).toEqual([11, 10, 2, 3]);
  });

  it('recense chaque écran prévu avec un titre et un chemin unique', () => {
    const screens = plannedScreens();
    expect(screens.get('/biens/immeubles')).toBe('Immeubles');
    for (const href of ['/deconnexion', '/choix-du-profil', '/notifications']) expect(screens.has(href), href).toBe(false);
    expect(screens.has('/')).toBe(false);
    for (const href of screens.keys()) expect(href).toMatch(/^\/[a-z0-9\-/]+$/);
  });
});
