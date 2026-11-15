import { describe, expect, it } from 'vitest';
import { accountMenu, bottomItems, buildNavigation, plannedScreens, searchPages } from './config';

const navigation = buildNavigation({ loyers: 1, messages: 1, interventions: 1 });
const entries = [...navigation.sections.flatMap((section) => section.entries), ...navigation.footer];
const linkedHrefs = [
  ...entries.map((entry) => entry.href),
  ...bottomItems.map((item) => item.href),
  ...accountMenu.groups.flatMap((group) => group.items.map((item) => item.href)),
  ...(accountMenu.switchSpace ? [accountMenu.switchSpace.href] : []),
  accountMenu.signOut.href,
  ...searchPages.map((page) => page.href),
];

const DELIVERED_ROUTES = new Set([
  '/',
  '/bail',
  '/bail/conge',
  '/loyers',
  '/loyers/payer',
  '/loyers/prelevement',
  '/loyers/regularisation',
  '/etats-des-lieux',
  '/documents',
  '/interventions',
  '/interventions/nouvelle',
  '/assurance',
  '/assurance/deposer',
  '/compte',
  '/compte/modifier',
  '/compte/securite',
  '/notifications',
  '/messages',
  '/messages/nouveau',
  '/aide',
]);

describe('navigation de l’espace locataire', () => {
  it('chaque lien mène à un écran livré ou à un écran prévu', () => {
    for (const href of linkedHrefs) {
      expect(DELIVERED_ROUTES.has(href) || plannedScreens.has(href), href).toBe(true);
    }
  });

  it('la barre mobile reprend des entrées de la navigation (mêmes id)', () => {
    const ids = new Set(entries.map((entry) => entry.id));
    for (const item of bottomItems) expect(ids.has(item.id), item.id).toBe(true);
  });

  it('la messagerie et l’aide sont livrées, sans écran d’inscription prévu', () => {
    for (const href of ['/messages', '/messages/nouveau', '/aide']) expect(plannedScreens.has(href), href).toBe(false);
    expect([...plannedScreens.keys()].some((href) => href.includes('inscription') || href.startsWith('/messages'))).toBe(false);
  });

  it('un écran livré ne figure pas dans les écrans prévus', () => {
    for (const href of DELIVERED_ROUTES) expect(plannedScreens.has(href), href).toBe(false);
  });

  it('le menu du compte renvoie vers les écrans du compte et le choix du profil', () => {
    const hrefs = accountMenu.groups.flatMap((group) => group.items.map((item) => item.href));
    expect(hrefs).toEqual(['/compte', '/compte/securite', '/notifications']);
    expect(accountMenu.switchSpace?.href).toBe('/choix-du-profil');
  });

  it('affiche les compteurs fournis par la source', () => {
    const loyers = entries.find((entry) => entry.id === 'loyers');
    expect(loyers?.count).toBe(1);
    expect(buildNavigation().sections[0]?.entries.find((entry) => entry.id === 'loyers')?.count).toBeUndefined();
  });

  it('les identifiants de navigation sont uniques', () => {
    const ids = entries.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
