import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../test/axe';
import { TestLink, renderWithSource } from '../../test/render';
import { GestionShell } from './GestionShell';

function renderShell(currentPath = '/') {
  const onNavigate = vi.fn();
  const view = renderWithSource(
    <GestionShell
      spaceLabel="Espace bailleur"
      logoSrc="/logo.png"
      currentPath={currentPath}
      linkComponent={TestLink}
      onNavigate={onNavigate}
    >
      <h1>Contenu</h1>
    </GestionShell>,
  );
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
