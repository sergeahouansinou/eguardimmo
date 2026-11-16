import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../test/axe';
import {
  createTestSource,
  testAccountMenu,
  testBottomItems,
  testNavigation,
  testPages,
  testShell,
} from '../../test/fixtures';
import { TestLink, renderWithSource } from '../../test/render';
import { filterPages } from './CommandPalette';
import { SpaceShell } from './SpaceShell';
import type { SpaceShellProps } from './SpaceShell';

type Overrides = Partial<Omit<SpaceShellProps, 'children'>>;

function renderShell(overrides: Overrides = {}, currentPath = '/') {
  const onNavigate = vi.fn();
  const props: ComponentProps<typeof SpaceShell> = {
    spaceLabel: 'Espace démo',
    logoSrc: '/logo.png',
    currentPath,
    linkComponent: TestLink,
    onNavigate,
    railStorageKey: 'eg-nav-test',
    navigation: testNavigation,
    bottomItems: testBottomItems,
    accountMenu: testAccountMenu,
    notifications: { allHref: '/notifications', settingsHref: '/notifications/reglages' },
    searchPages: testPages,
    addMenu: [{ label: 'Création', items: [{ id: 'nouveau-bien', label: 'Nouveau bien', href: '/biens/nouveau' }] }],
    helpMenu: [
      { id: 'aide', label: "Centre d'aide", href: '/aide' },
      { id: 'raccourcis', label: 'Raccourcis clavier', href: '/aide/raccourcis', shortcut: '?', separatorBefore: true },
    ],
    ...overrides,
    children: <h1>Contenu</h1>,
  };
  const view = renderWithSource(<SpaceShell {...props} />, createTestSource());
  return { ...view, onNavigate };
}

afterEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
});

describe('SpaceShell', () => {
  it('affiche la navigation fournie avec les compteurs du compte', async () => {
    renderShell();
    const side = screen.getByRole('navigation', { name: 'Navigation principale' });
    expect(within(side).getByRole('link', { name: 'Accueil' }).getAttribute('aria-current')).toBe('page');
    expect(await within(side).findByRole('link', { name: /Biens\s*4/ })).toBeTruthy();
    expect(screen.getByText('Espace démo')).toBeTruthy();
  });

  it('accepte une navigation statique', () => {
    renderShell({ navigation: testNavigation() });
    expect(screen.getByRole('link', { name: 'Impayés' })).toBeTruthy();
  });

  it('replie la barre latérale et mémorise le choix sous la clé de l’application', async () => {
    renderShell();
    await userEvent.click(screen.getByRole('button', { name: 'Replier la barre latérale' }));
    expect(window.localStorage.getItem('eg-nav-test')).toBe('collapsed');
    expect(screen.getByRole('button', { name: 'Déplier la barre latérale' })).toBeTruthy();
  });

  it('ouvre la recherche avec ⌘K et navigue vers la page choisie', async () => {
    const { onNavigate } = renderShell({ searchPlaceholder: 'Rechercher, ex. : Impayés' });
    await userEvent.keyboard('{Meta>}k{/Meta}');
    const input = await screen.findByRole('combobox', { name: 'Rechercher une page' });
    expect(document.activeElement).toBe(input);
    expect(input.getAttribute('placeholder')).toBe('Rechercher, ex. : Impayés');
    await userEvent.type(input, 'impay');
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['Impayés']);
    await userEvent.keyboard('{Enter}');
    expect(onNavigate).toHaveBeenCalledWith('/impayes');
    expect(screen.queryByRole('dialog', { name: 'Recherche' })).toBeNull();
  });

  it('crée depuis le menu Ajouter et ouvre le menu Aide', async () => {
    const { onNavigate } = renderShell();
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Nouveau bien' }));
    expect(onNavigate).toHaveBeenCalledWith('/biens/nouveau');
    await userEvent.click(screen.getByRole('button', { name: 'Aide' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /Raccourcis clavier/ }));
    expect(onNavigate).toHaveBeenCalledWith('/aide/raccourcis');
  });

  it('masque Ajouter et Aide quand aucun menu n’est fourni', () => {
    renderShell({ addMenu: [], helpMenu: [] });
    expect(screen.queryByRole('button', { name: 'Ajouter' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Aide' })).toBeNull();
  });

  it('marque toutes les notifications comme lues', async () => {
    renderShell();
    await userEvent.click(await screen.findByRole('button', { name: 'Notifications, 1 non lues' }));
    const panel = await screen.findByRole('dialog', { name: 'Notifications' });
    expect(within(panel).getAllByText('Non lue')).toHaveLength(1);
    expect(within(panel).getByRole('link', { name: 'Voir toutes les notifications' }).getAttribute('href')).toBe('/notifications');
    await userEvent.click(within(panel).getByRole('button', { name: 'Tout marquer comme lu' }));
    await waitFor(() => { expect(within(panel).queryAllByText('Non lue')).toHaveLength(0); });
  });

  it('masque le bouton de réglages des notifications sans lien configuré', async () => {
    renderShell({ notifications: { allHref: '/notifications' } });
    await userEvent.click(await screen.findByRole('button', { name: 'Notifications, 1 non lues' }));
    const panel = await screen.findByRole('dialog', { name: 'Notifications' });
    expect(within(panel).queryByRole('button', { name: 'Réglages des notifications' })).toBeNull();
  });

  it('propose « Changer d’espace » seulement s’il est configuré', async () => {
    const { unmount } = renderShell({ accountMenu: { ...testAccountMenu, switchSpace: { href: '/choix-du-profil' } } });
    await userEvent.click(await screen.findByRole('button', { name: 'Compte, espace de travail Espace test' }));
    expect(await screen.findByRole('menuitem', { name: "Changer d'espace" })).toBeTruthy();
    unmount();
    renderShell();
    await userEvent.click(await screen.findByRole('button', { name: 'Compte, espace de travail Espace test' }));
    const menu = await screen.findByRole('menu');
    expect(within(menu).queryByRole('menuitem', { name: "Changer d'espace" })).toBeNull();
    expect(within(menu).getByRole('menuitem', { name: /Mon compte/ })).toBeTruthy();
  });

  it('navigue depuis le menu du compte et se déconnecte', async () => {
    const { onNavigate } = renderShell();
    await userEvent.click(await screen.findByRole('button', { name: 'Compte, espace de travail Espace test' }));
    const menu = await screen.findByRole('menu');
    expect(menu.textContent).toContain('awa.diallo@example.com');
    expect(within(menu).getByText('Admin')).toBeTruthy();
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Se déconnecter' }));
    expect(onNavigate).toHaveBeenCalledWith('/deconnexion');
  });

  it('rend de vrais liens pour les adresses d’une autre application, sans passer par onNavigate', async () => {
    const { onNavigate } = renderShell({
      accountMenu: {
        ...testAccountMenu,
        switchSpace: { href: 'http://localhost:3040/profils' },
        signOut: { href: 'http://localhost:3040/deconnecte' },
      },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Compte, espace de travail Espace test' }));
    const menu = await screen.findByRole('menu');
    const switchSpace = within(menu).getByRole('menuitem', { name: "Changer d'espace" });
    const signOut = within(menu).getByRole('menuitem', { name: 'Se déconnecter' });
    expect(switchSpace.tagName).toBe('A');
    expect(switchSpace.getAttribute('href')).toBe('http://localhost:3040/profils');
    expect(signOut.tagName).toBe('A');
    expect(signOut.getAttribute('href')).toBe('http://localhost:3040/deconnecte');
    expect(onNavigate).not.toHaveBeenCalled();
    await expectNoA11yViolations(menu);
  });

  it('change l’apparence depuis le menu du compte', async () => {
    renderShell();
    await userEvent.click(await screen.findByRole('button', { name: 'Compte, espace de travail Espace test' }));
    const menu = await screen.findByRole('menu');
    await userEvent.click(within(menu).getByRole('menuitemradio', { name: 'Sombre' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(window.localStorage.getItem('eg-theme')).toBe('dark');
  });

  it('ouvre la feuille « Plus » sans les entrées de la barre mobile', async () => {
    renderShell();
    await userEvent.click(screen.getByRole('button', { name: 'Plus' }));
    const sheet = await screen.findByRole('dialog', { name: 'Plus' });
    expect(within(sheet).getByRole('link', { name: 'Impayés' })).toBeTruthy();
    expect(within(sheet).getByRole('link', { name: 'Réglages' })).toBeTruthy();
    expect(within(sheet).queryByRole('link', { name: 'Accueil' })).toBeNull();
    expect(within(sheet).queryByRole('link', { name: /Biens/ })).toBeNull();
  });

  it('n’a aucune violation axe', async () => {
    const { container } = renderShell({}, '/impayes');
    await screen.findByRole('button', { name: 'Notifications, 1 non lues' });
    await expectNoA11yViolations(container);
  });
});

describe('SpaceShell avec un compte sans notification ni propriétaire', () => {
  function renderMinimal() {
    const source = createTestSource();
    const bare = { ...testShell, workspace: { name: 'Espace test', role: 'admin' }, counts: {}, notifications: [] };
    return renderWithSource(
      <SpaceShell
        spaceLabel="Espace démo"
        logoSrc="/logo.png"
        currentPath="/"
        linkComponent={TestLink}
        onNavigate={vi.fn()}
        railStorageKey="eg-nav-test"
        navigation={testNavigation}
        bottomItems={testBottomItems}
        accountMenu={{ ...testAccountMenu, switchSpace: { href: '/choix-du-profil' } }}
        notifications={{ allHref: '/notifications' }}
        searchPages={testPages}
      >
        <h1>Contenu</h1>
      </SpaceShell>,
      { ...source, shell: () => Promise.resolve(bare) },
    );
  }

  it('masque « Espace de … » quand le propriétaire n’est pas fourni', async () => {
    renderMinimal();
    await userEvent.click(await screen.findByRole('button', { name: 'Compte, espace de travail Espace test' }));
    const menu = await screen.findByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: "Changer d'espace" })).toBeTruthy();
    expect(within(menu).queryByText(/Espace de /)).toBeNull();
  });

  it('dit « Aucune notification » quand la liste est vide', async () => {
    renderMinimal();
    await userEvent.click(await screen.findByRole('button', { name: 'Notifications' }));
    const panel = await screen.findByRole('dialog', { name: 'Notifications' });
    expect(within(panel).getByText('Aucune notification.')).toBeTruthy();
    expect(within(panel).getByRole('button', { name: 'Tout marquer comme lu' }).hasAttribute('disabled')).toBe(true);
  });
});

describe('filterPages', () => {
  it('ignore accents et casse', () => {
    expect(filterPages('ECHEANCE', testPages).map((page) => page.href)).toEqual(['/documents/avis-echeance']);
  });

  it('retourne les premières pages quand la requête est vide', () => {
    expect(filterPages('  ', testPages)).toHaveLength(3);
  });
});
