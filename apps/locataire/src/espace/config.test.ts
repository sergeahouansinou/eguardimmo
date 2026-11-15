import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { accountMenu, bottomItems, buildNavigation, notifications, searchPages } from './config';

const navigation = buildNavigation({ loyers: 1, messages: 1, interventions: 1 });
const entries = [...navigation.sections.flatMap((section) => section.entries), ...navigation.footer];
const linkedHrefs = [
  ...entries.map((entry) => entry.href),
  ...bottomItems.map((item) => item.href),
  ...accountMenu.groups.flatMap((group) => group.items.map((item) => item.href)),
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
  '/notifications/toutes',
  '/messages',
  '/messages/nouveau',
  '/aide',
]);

describe('navigation de l’espace locataire', () => {
  it('chaque écran livré a bien un fichier de route', () => {
    for (const href of DELIVERED_ROUTES) {
      const page = join(__dirname, '..', 'app', '(espace)', href === '/' ? '' : href, 'page.tsx');
      expect(existsSync(page), href).toBe(true);
    }
  });

  it('chaque lien interne mène à un écran livré', () => {
    for (const href of [...linkedHrefs, notifications.allHref, notifications.settingsHref ?? '']) {
      expect(DELIVERED_ROUTES.has(href), href).toBe(true);
    }
  });

  it('la barre mobile reprend des entrées de la navigation (mêmes id)', () => {
    const ids = new Set(entries.map((entry) => entry.id));
    for (const item of bottomItems) expect(ids.has(item.id), item.id).toBe(true);
  });

  it('la messagerie et l’aide sont livrées', () => {
    for (const href of ['/messages', '/messages/nouveau', '/aide']) expect(DELIVERED_ROUTES.has(href), href).toBe(true);
  });

  it('le menu du compte renvoie vers les écrans du compte, et vers l’application d’authentification pour le profil et la déconnexion', () => {
    const hrefs = accountMenu.groups.flatMap((group) => group.items.map((item) => item.href));
    expect(hrefs).toEqual(['/compte', '/compte/securite', '/notifications']);
    expect(accountMenu.switchSpace?.href).toBe('http://localhost:3040/profils');
    expect(accountMenu.signOut.href).toBe('http://localhost:3040/deconnecte');
  });

  it('le centre de notifications est distinct des préférences', () => {
    expect(notifications).toEqual({ allHref: '/notifications/toutes', settingsHref: '/notifications' });
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
