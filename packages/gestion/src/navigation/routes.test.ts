import { describe, expect, it } from 'vitest';
import { buildNavigation, plannedScreens, supportSearchPages } from './routes';
import type { SupportNavigation } from './routes';

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

  it('ajoute l’entrée Loyers après Finances seulement sur demande', () => {
    const entries = (rent: boolean) => buildNavigation(undefined, { rent }).sections[0]?.entries ?? [];
    expect(entries(false).map((entry) => entry.id)).not.toContain('loyers');
    expect(entries(true).map((entry) => entry.label)).toEqual(['Accueil', 'Biens', 'Locataires', 'Baux', 'Finances', 'Loyers', 'Documents']);
    expect(entries(true).find((entry) => entry.id === 'loyers')?.href).toBe('/finances/loyers');
  });

  it('ajoute l’entrée Conformité au suivi seulement sur demande, sans toucher aux entrées de la démo', () => {
    const suivi = (compliance: boolean) => buildNavigation(undefined, { rent: false, compliance }).sections[1]?.entries ?? [];
    expect(suivi(false).map((entry) => entry.id)).not.toContain('conformite');
    expect(suivi(true).find((entry) => entry.id === 'conformite')?.href).toBe('/conformite');
    expect(suivi(true)).toHaveLength(suivi(false).length + 1);
    expect(buildNavigation().sections.flatMap((section) => section.entries)).toHaveLength(buildNavigation(undefined, { rent: false }).sections.flatMap((section) => section.entries).length);
  });

  it('ajoute Coût de revient et Fiscalité sous Finances seulement sur demande', () => {
    const children = (tax: boolean) => buildNavigation(undefined, { rent: false, tax }).sections[0]?.entries.find((entry) => entry.id === 'finances')?.children ?? [];
    expect(children(false).map((child) => child.id)).not.toContain('fiscalite');
    expect(children(true).filter((child) => ['cout-de-revient', 'fiscalite'].includes(child.id)).map((child) => child.href)).toEqual(['/finances/cout-de-revient', '/finances/fiscalite']);
    expect(children(true)).toHaveLength(children(false).length + 2);
  });

  it('garde Impayés actif sur les dossiers de recouvrement, dans les deux modes', () => {
    for (const rent of [false, true]) {
      const finances = buildNavigation(undefined, { rent }).sections[0]?.entries.find((entry) => entry.id === 'finances');
      const impayes = finances?.children?.find((child) => child.id === 'impayes');
      expect(impayes?.href, String(rent)).toBe('/finances/impayes');
      expect(impayes?.activeFor, String(rent)).toEqual(['/finances/recouvrement']);
    }
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

describe('navigation du support', () => {
  const footer = (support?: SupportNavigation) => buildNavigation(undefined, { rent: true, ...(support ? { support } : {}) }).footer;

  it('n’ajoute rien sans support', () => {
    expect(footer().map((entry) => entry.id)).toEqual(['reglages', 'equipe']);
    expect(footer()[0]?.children).toBeUndefined();
  });

  it('ajoute Support avec le nombre de réponses à lire, pour tous les rôles', () => {
    const entries = footer({ manageAccess: false, requests: 2 });
    expect(entries.map((entry) => entry.id)).toEqual(['reglages', 'equipe', 'support']);
    expect(entries.find((entry) => entry.id === 'support')).toMatchObject({ href: '/support', count: 2 });
    expect(entries[0]?.children).toBeUndefined();
  });

  it('ne montre les accès du support qu’au propriétaire et aux administrateurs, avec le nombre en attente', () => {
    const settings = footer({ manageAccess: true, access: 3 })[0];
    expect(settings?.count).toBe(3);
    expect(settings?.children?.map((child) => child.href)).toEqual(['/reglages', '/reglages/acces-support']);
  });

  it('n’affiche aucun compteur à zéro ou inconnu', () => {
    const entries = footer({ manageAccess: true, requests: 0, access: undefined });
    expect(entries.find((entry) => entry.id === 'support')?.count).toBeUndefined();
    expect(entries[0]?.count).toBeUndefined();
  });

  it('expose les pages du support à la recherche', () => {
    expect(supportSearchPages.map((page) => page.href)).toEqual(['/support', '/support/nouvelle', '/reglages/acces-support']);
  });
});


describe('navigation du fuseau horaire', () => {
  const settings = (options: Parameters<typeof buildNavigation>[1]) => buildNavigation(undefined, options).footer.find((entry) => entry.id === 'reglages');

  it('n’ajoute aucun sous-menu sans droit de réglage', () => {
    expect(settings({ rent: true })?.children).toBeUndefined();
  });

  it('ajoute la page du fuseau pour le titulaire et l’administrateur', () => {
    expect(settings({ rent: true, timezone: true })?.children?.map((child) => child.href)).toEqual(['/reglages', '/reglages/fuseau-horaire']);
  });

  it('place le fuseau avant l’accès du support', () => {
    const support = { manageAccess: true };
    expect(settings({ rent: true, timezone: true, support })?.children?.map((child) => child.href)).toEqual(['/reglages', '/reglages/fuseau-horaire', '/reglages/acces-support']);
  });
});
