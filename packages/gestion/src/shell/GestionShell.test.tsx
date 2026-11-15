import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../test/axe';
import { TestLink, renderWithSource } from '../../test/render';
import { GestionShell } from './GestionShell';
import type { GestionShellProps } from './GestionShell';

function shellElement(onNavigate: (href: string) => void, currentPath = '/', extra: Partial<GestionShellProps> = {}) {
  return (
    <GestionShell
      spaceLabel="Espace bailleur"
      logoSrc="/logo.png"
      currentPath={currentPath}
      linkComponent={TestLink}
      onNavigate={onNavigate}
      {...extra}
    >
      <h1>Contenu</h1>
      <input aria-label="Champ de saisie" placeholder="Ex. Koffi Adjovi" />
    </GestionShell>
  );
}

function renderShell(currentPath = '/', extra: Partial<GestionShellProps> = {}) {
  const onNavigate = vi.fn();
  const view = renderWithSource(shellElement(onNavigate, currentPath, extra));
  return { ...view, onNavigate };
}

afterEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
});

describe('GestionShell', () => {
  it('affiche la navigation avec les compteurs du compte', async () => {
    renderShell('/');
    const side = screen.getByRole('navigation', { name: 'Navigation principale' });
    expect(within(side).getByRole('link', { name: 'Accueil' }).getAttribute('aria-current')).toBe('page');
    expect(await within(side).findByRole('link', { name: /Messages\s*2/ })).toBeTruthy();
    expect(within(side).getByRole('button', { name: /Biens\s*11/ })).toBeTruthy();
  });

  it('reflète le compteur de messages non lus fourni par la messagerie, puis le fait baisser', async () => {
    function Harness() {
      const [unread, setUnread] = useState(2);
      return (
        <>
          {shellElement(vi.fn(), '/', { unreadMessages: unread })}
          <button type="button" onClick={() => { setUnread((value) => value - 1); }}>Lire un message</button>
        </>
      );
    }
    renderWithSource(<Harness />);
    const side = screen.getByRole('navigation', { name: 'Navigation principale' });
    expect(await within(side).findByRole('link', { name: /Messages\s*2/ })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Lire un message' }));
    expect(await within(side).findByRole('link', { name: /Messages\s*1$/ })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Lire un message' }));
    expect(await within(side).findByRole('link', { name: 'Messages' })).toBeTruthy();
    expect(within(side).queryByRole('link', { name: /Messages\s*\d/ })).toBeNull();
  });

  it('replie la barre latérale et mémorise le choix', async () => {
    renderShell();
    await userEvent.click(screen.getByRole('button', { name: 'Replier la barre latérale' }));
    expect(window.localStorage.getItem('eg-nav')).toBe('collapsed');
    expect(screen.getByRole('button', { name: 'Déplier la barre latérale' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Principal' })).toBeNull();
  });

  it('ouvre la recherche avec ⌘K et navigue vers la page choisie', async () => {
    const { onNavigate } = renderShell();
    await userEvent.keyboard('{Meta>}k{/Meta}');
    const input = await screen.findByRole('combobox', { name: 'Rechercher une page' });
    expect(document.activeElement).toBe(input);
    await userEvent.type(input, 'impay');
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['Impayés']);
    await userEvent.keyboard('{Enter}');
    expect(onNavigate).toHaveBeenCalledWith('/finances/impayes');
    expect(screen.queryByRole('dialog', { name: 'Recherche' })).toBeNull();
  });

  it('ouvre les raccourcis clavier avec ?, sauf pendant une saisie', async () => {
    const { onNavigate } = renderShell();
    await userEvent.type(screen.getByRole('textbox', { name: 'Champ de saisie' }), '?');
    expect(onNavigate).not.toHaveBeenCalled();
    await userEvent.click(document.body);
    await userEvent.keyboard('?');
    expect(onNavigate).toHaveBeenCalledWith('/aide/raccourcis');
  });

  it('crée depuis le menu Ajouter', async () => {
    const { onNavigate } = renderShell();
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Nouveau bail' }));
    expect(onNavigate).toHaveBeenCalledWith('/baux/nouveau');
  });

  it('marque toutes les notifications comme lues', async () => {
    renderShell();
    await userEvent.click(await screen.findByRole('button', { name: 'Notifications, 3 non lues' }));
    const panel = await screen.findByRole('dialog', { name: 'Notifications' });
    expect(within(panel).getAllByText('Non lue')).toHaveLength(3);
    await userEvent.click(within(panel).getByRole('button', { name: 'Tout marquer comme lu' }));
    await waitFor(() => { expect(within(panel).queryAllByText('Non lue')).toHaveLength(0); });
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeTruthy();
  });

  it('nomme le menu du compte et reprend les icônes de la maquette', async () => {
    renderShell();
    await userEvent.click(await screen.findByRole('button', { name: 'Compte, espace de travail Gestion Les Tilleuls' }));
    const menu = await screen.findByRole('menu', { name: 'Menu du compte' });
    const icons = (name: string) => within(menu).getByRole('menuitem', { name }).querySelectorAll('svg');
    expect(icons('Mon compte')[0]?.classList.contains('lucide-user')).toBe(true);
    expect(icons('Connexion et sécurité')[0]?.classList.contains('lucide-shield-check')).toBe(true);
    const [first, last] = icons("Changer d'espace");
    expect(first?.classList.contains('lucide-building-complex')).toBe(true);
    expect(last?.classList.contains('lucide-chevrons-up-down')).toBe(true);
  });

  it('change l’apparence depuis le menu du compte', async () => {
    renderShell();
    await userEvent.click(await screen.findByRole('button', { name: 'Compte, espace de travail Gestion Les Tilleuls' }));
    const menu = await screen.findByRole('menu');
    expect(menu.textContent).toContain('marc.chevalier@example.com');
    await userEvent.click(within(menu).getByRole('menuitemradio', { name: 'Sombre' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(window.localStorage.getItem('eg-theme')).toBe('dark');
  });

  it('ouvre la feuille « Plus » avec les sections hors barre mobile', async () => {
    renderShell();
    await userEvent.click(screen.getByRole('button', { name: 'Plus' }));
    const sheet = await screen.findByRole('dialog', { name: 'Plus' });
    expect(within(sheet).getByRole('link', { name: 'Baux' })).toBeTruthy();
    expect(within(sheet).getByRole('link', { name: /Interventions/ })).toBeTruthy();
    expect(within(sheet).queryByRole('link', { name: 'Accueil' })).toBeNull();
  });

  it('n’a aucune violation axe', async () => {
    const { container } = renderShell('/biens/immeubles');
    await screen.findByRole('button', { name: 'Notifications, 3 non lues' });
    await expectNoA11yViolations(container);
  });
});
