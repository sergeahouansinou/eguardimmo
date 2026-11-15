import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../../../test/axe';
import { createDemoBiensSource } from '../../demo/store';
import { immeublesSchema } from '../../schemas/immeubles';
import { failingSource, renderBiens } from '../../testing/harness';
import { ImmeublesScreen } from './ImmeublesScreen';

const EMPTY_IMMEUBLE = { name: 'Villa Neuve', address: '4 rue Neuve', postalCode: '31000', city: 'Toulouse', country: 'France', repartition: 'tantiemes' as const, photoNames: [] };

async function listed(source = createDemoBiensSource({ latencyMs: 0 })) {
  const view = renderBiens(<ImmeublesScreen />, { source });
  await screen.findByRole('table', { name: 'Liste des immeubles' });
  return view;
}

async function withEmptyImmeuble() {
  const source = createDemoBiensSource({ latencyMs: 0 });
  await source.createImmeuble(EMPTY_IMMEUBLE);
  return source;
}

describe('ImmeublesScreen', () => {
  it('liste les immeubles actifs avec leur copropriété et les compteurs des onglets', async () => {
    await listed();
    const table = screen.getByRole('table', { name: 'Liste des immeubles' });
    expect(within(table).getByRole('link', { name: 'Les Tilleuls' }).getAttribute('href')).toBe('/biens/immeubles/les-tilleuls');
    expect(within(table).getAllByRole('row')).toHaveLength(4);
    expect(within(table).getByText('Copropriété')).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Actifs\s*3/ })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Archives\s*0/ })).toBeTruthy();
  });

  it('filtre par recherche et par ville, puis propose de réinitialiser', async () => {
    await listed();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Rechercher un immeuble' }), 'Rivière');
    expect(within(screen.getByRole('table', { name: 'Liste des immeubles' })).getAllByRole('row')).toHaveLength(2);
    await userEvent.clear(screen.getByRole('searchbox', { name: 'Rechercher un immeuble' }));
    await userEvent.click(screen.getByRole('combobox', { name: /Ville/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Lyon' }));
    const rows = within(screen.getByRole('table', { name: 'Liste des immeubles' })).getAllByRole('row');
    expect(rows).toHaveLength(2);
    expect(rows[1]?.textContent).toContain('Résidence du Parc');
    await userEvent.type(screen.getByRole('searchbox', { name: 'Rechercher un immeuble' }), 'zzzz');
    expect(await screen.findByText('Aucun immeuble ne correspond')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Réinitialiser les filtres' }));
    expect(within(await screen.findByRole('table', { name: 'Liste des immeubles' })).getAllByRole('row')).toHaveLength(4);
  });

  it('trie par nombre de lots', async () => {
    await listed();
    await userEvent.click(screen.getByRole('button', { name: 'Lots' }));
    const ascending = within(screen.getByRole('table', { name: 'Liste des immeubles' })).getAllByRole('row');
    expect(ascending[1]?.textContent).not.toContain('Les Tilleuls');
    expect(ascending[3]?.textContent).toContain('Les Tilleuls');
    await userEvent.click(screen.getByRole('button', { name: 'Lots' }));
    expect(within(screen.getByRole('table', { name: 'Liste des immeubles' })).getAllByRole('row')[1]?.textContent).toContain('Les Tilleuls');
  });

  it('propose les actions de ligne vers les écrans de l’immeuble', async () => {
    const { push } = await listed();
    await userEvent.click(screen.getByRole('button', { name: 'Autres actions, Les Tilleuls' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Répartition des charges' }));
    expect(push).toHaveBeenCalledWith('/biens/immeubles/les-tilleuls/charges');
    await userEvent.click(screen.getByRole('button', { name: 'Autres actions, Les Tilleuls' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Modifier' }));
    expect(push).toHaveBeenCalledWith('/biens/immeubles/les-tilleuls/modifier');
  });

  it('refuse d’archiver un immeuble qui compte des lots actifs', async () => {
    await listed();
    await userEvent.click(screen.getByRole('button', { name: 'Autres actions, Les Tilleuls' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Archiver' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Archiver' }));
    expect(await screen.findByText('Action impossible')).toBeTruthy();
    expect(screen.getByText('L’immeuble compte 5 biens actifs : archivez-les d’abord.')).toBeTruthy();
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('tab', { name: /Actifs\s*3/ })).toBeTruthy();
  });

  it('archive un immeuble vide après confirmation puis le restaure', async () => {
    const source = await withEmptyImmeuble();
    await listed(source);
    await userEvent.click(screen.getByRole('button', { name: 'Autres actions, Villa Neuve' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Archiver' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Archiver' }));
    await waitFor(() => { expect(screen.getByRole('tab', { name: /Archives\s*1/ })).toBeTruthy(); });
    expect(screen.getByText('Immeuble archivé')).toBeTruthy();
    await userEvent.click(screen.getByRole('tab', { name: /Archives/ }));
    const table = await screen.findByRole('table', { name: 'Immeubles archivés' });
    await userEvent.click(within(table).getByRole('button', { name: 'Autres actions, Villa Neuve' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Restaurer' }));
    await waitFor(() => { expect(screen.getByRole('tab', { name: /Actifs\s*4/ })).toBeTruthy(); });
    expect(screen.getByText('Immeuble restauré')).toBeTruthy();
  });

  it('supprime un immeuble vide après confirmation', async () => {
    const source = await withEmptyImmeuble();
    await listed(source);
    await userEvent.click(screen.getByRole('button', { name: 'Autres actions, Villa Neuve' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Supprimer' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Supprimer' }));
    await waitFor(() => { expect(screen.getByRole('tab', { name: /Actifs\s*3/ })).toBeTruthy(); });
    expect(screen.getByText('Immeuble supprimé')).toBeTruthy();
    expect(immeublesSchema.parse(await source.immeubles()).items.some((item) => item.name === 'Villa Neuve')).toBe(false);
  });

  it('refuse de supprimer un immeuble auquel des biens sont rattachés', async () => {
    await listed();
    await userEvent.click(screen.getByRole('button', { name: 'Autres actions, Maison Rivière' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Supprimer' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Supprimer' }));
    expect(await screen.findByText(/Suppression impossible : des biens sont rattachés/)).toBeTruthy();
  });

  it('affiche une erreur avec reprise quand le chargement échoue', async () => {
    renderBiens(<ImmeublesScreen />, { source: failingSource(['immeubles']) });
    expect(await screen.findByText('Les immeubles n’ont pas pu être chargés')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeTruthy();
  });

  it('ne présente aucune violation d’accessibilité', async () => {
    const { container } = await listed();
    await expectNoA11yViolations(container);
  });
});
