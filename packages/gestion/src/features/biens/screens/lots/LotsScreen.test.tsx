import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../../../test/axe';
import { failingSource, renderBiens } from '../../testing/harness';
import { LotsScreen } from './LotsScreen';

async function listed() {
  const view = renderBiens(<LotsScreen />);
  await screen.findByRole('table', { name: 'Liste des lots' });
  return view;
}

describe('LotsScreen', () => {
  it('liste les lots actifs avec les compteurs des onglets', async () => {
    await listed();
    const table = screen.getByRole('table', { name: 'Liste des lots' });
    expect(within(table).getByRole('link', { name: 'Apt A1' }).getAttribute('href')).toBe('/biens/apt-a1');
    expect(screen.getByRole('tab', { name: /Lots\s*14/ })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Immeubles\s*3/ })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Archivés\s*2/ })).toBeTruthy();
  });

  it('propose le filtre « En travaux » en démonstration', async () => {
    await listed();
    expect(screen.getByRole('button', { name: 'En travaux' })).toBeTruthy();
  });

  it('filtre par recherche et propose de réinitialiser quand rien ne correspond', async () => {
    await listed();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Rechercher un lot' }), 'Adjovi');
    const table = screen.getByRole('table', { name: 'Liste des lots' });
    expect(within(table).getAllByRole('row')).toHaveLength(2);
    await userEvent.clear(screen.getByRole('searchbox', { name: 'Rechercher un lot' }));
    await userEvent.type(screen.getByRole('searchbox', { name: 'Rechercher un lot' }), 'zzzz');
    expect(await screen.findByText('Aucun lot ne correspond')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Réinitialiser les filtres' }));
    expect(await screen.findByRole('table', { name: 'Liste des lots' })).toBeTruthy();
  });

  it('trie par colonne', async () => {
    await listed();
    await userEvent.click(screen.getByRole('button', { name: 'Surface' }));
    const first = within(screen.getByRole('table', { name: 'Liste des lots' })).getAllByRole('row')[1];
    expect(first?.textContent).toContain('Parking P4');
    await userEvent.click(screen.getByRole('button', { name: 'Surface' }));
    expect(within(screen.getByRole('table', { name: 'Liste des lots' })).getAllByRole('row')[1]?.textContent).not.toContain('Parking P4');
  });

  it('archive un lot après confirmation puis le retrouve dans les archives', async () => {
    await listed();
    await userEvent.click(screen.getByRole('button', { name: 'Autres actions, Apt D4' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Archiver' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Archiver' }));
    await waitFor(() => { expect(screen.getByRole('tab', { name: /Archivés\s*3/ })).toBeTruthy(); });
    expect(screen.getByText('1 bien archivé')).toBeTruthy();
    await userEvent.click(screen.getByRole('tab', { name: /Archivés/ }));
    expect(within(await screen.findByRole('table', { name: 'Lots archivés' })).getByText('Apt D4')).toBeTruthy();
  });

  it('refuse d’archiver un lot loué et l’annonce par un message', async () => {
    await listed();
    await userEvent.click(screen.getByRole('button', { name: 'Autres actions, Apt A1' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Archiver' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Archiver' }));
    expect(await screen.findByText('Action impossible')).toBeTruthy();
    expect(screen.getByText('Le bien « Apt A1 » est loué : mettez fin au bail avant de l’archiver.')).toBeTruthy();
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('tab', { name: /Lots\s*14/ })).toBeTruthy();
  });

  it('affiche une erreur avec reprise quand le chargement échoue', async () => {
    renderBiens(<LotsScreen />, { source: failingSource(['lots']) });
    expect(await screen.findByText('Les biens n’ont pas pu être chargés')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeTruthy();
  });

  it('ne présente aucune violation d’accessibilité', async () => {
    const { container } = await listed();
    await expectNoA11yViolations(container);
  });
});
