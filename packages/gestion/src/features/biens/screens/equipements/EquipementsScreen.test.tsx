import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../../test/axe';
import { createDemoBiensSource } from '../../demo/store';
import { equipementsSchema } from '../../schemas/equipements';
import { failingSource, renderBiens } from '../../testing/harness';
import { EquipementsScreen } from './EquipementsScreen';

async function listed(source = createDemoBiensSource({ latencyMs: 0 })) {
  const view = renderBiens(<EquipementsScreen />, { source });
  await screen.findByRole('table', { name: 'Liste des équipements' });
  return view;
}

const rowsOf = () => within(screen.getByRole('table', { name: 'Liste des équipements' })).getAllByRole('row');

afterEach(() => {
  vi.restoreAllMocks();
});

describe('EquipementsScreen', () => {
  it('liste les équipements en service, alerte sur le matériel hors service et compte les onglets', async () => {
    await listed();
    expect(screen.getByRole('tab', { name: /En service\s*13/ })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Hors service\s*1/ })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Archives\s*2/ })).toBeTruthy();
    expect(screen.getByText('Chauffe-eau hors service, Villa RDC')).toBeTruthy();
    expect(within(screen.getByRole('table', { name: 'Liste des équipements' })).getByRole('link', { name: /^Climatiseur réversible/ }).getAttribute('href')).toBe('/biens/equipements/climatiseur-reversible');
  });

  it('filtre par recherche, par bien, par famille et par état', async () => {
    await listed();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Rechercher un équipement' }), 'climatiseur');
    expect(rowsOf()).toHaveLength(2);
    await userEvent.clear(screen.getByRole('searchbox', { name: 'Rechercher un équipement' }));
    await userEvent.click(screen.getByRole('combobox', { name: /Bien/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Apt A2' }));
    expect(rowsOf()).toHaveLength(2);
    expect(rowsOf()[1]?.textContent).toContain('Lave-vaisselle');
    await userEvent.type(screen.getByRole('searchbox', { name: 'Rechercher un équipement' }), 'zzzz');
    expect(await screen.findByText('Aucun équipement ne correspond')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Réinitialiser les filtres' }));
    const all = rowsOf().length;
    expect(all).toBeGreaterThan(10);
    await userEvent.click(screen.getByRole('button', { name: 'Sous garantie' }));
    expect(rowsOf().length).toBeLessThan(all);
    expect(screen.getByRole('button', { name: 'Sous garantie' }).getAttribute('aria-pressed')).toBe('true');
    await userEvent.click(screen.getByRole('button', { name: 'Sous garantie' }));
    await userEvent.click(screen.getByRole('combobox', { name: /Famille/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Cuisine' }));
    expect(rowsOf()).toHaveLength(4);
  });

  it('trie par nom', async () => {
    await listed();
    await userEvent.click(screen.getByRole('button', { name: 'Équipement' }));
    const first = rowsOf()[1]?.textContent;
    await userEvent.click(screen.getByRole('button', { name: 'Équipement' }));
    expect(rowsOf()[1]?.textContent).not.toBe(first);
  });

  it('affiche les équipements hors service et archivés dans leur onglet', async () => {
    await listed();
    await userEvent.click(screen.getByRole('tab', { name: /Hors service/ }));
    expect(await screen.findByText('Chauffe-eau')).toBeTruthy();
    await userEvent.click(screen.getByRole('tab', { name: /Archives/ }));
    const table = await screen.findByRole('table', { name: 'Équipements archivés' });
    expect(within(table).getByText('Ancienne chaudière')).toBeTruthy();
  });

  it('archive un équipement après confirmation puis le restaure', async () => {
    await listed();
    await userEvent.click(screen.getByRole('button', { name: 'Autres actions, Hotte aspirante' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Archiver' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Archiver' }));
    await waitFor(() => { expect(screen.getByRole('tab', { name: /Archives\s*3/ })).toBeTruthy(); });
    expect(screen.getByText('Équipement archivé')).toBeTruthy();
    await userEvent.click(screen.getByRole('tab', { name: /Archives/ }));
    const table = await screen.findByRole('table', { name: 'Équipements archivés' });
    await userEvent.click(within(table).getByRole('button', { name: 'Autres actions, Hotte aspirante' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Restaurer' }));
    await waitFor(() => { expect(screen.getByRole('tab', { name: /En service\s*13/ })).toBeTruthy(); });
    expect(screen.getByText('Équipement restauré')).toBeTruthy();
  });

  it('supprime un équipement après confirmation', async () => {
    const source = createDemoBiensSource({ latencyMs: 0 });
    await listed(source);
    await userEvent.click(screen.getByRole('button', { name: 'Autres actions, Hotte aspirante' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Supprimer' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Supprimer' }));
    await waitFor(() => { expect(screen.getByRole('tab', { name: /En service\s*12/ })).toBeTruthy(); });
    expect(screen.getByText('Équipement supprimé')).toBeTruthy();
    expect(equipementsSchema.parse(await source.equipements()).items.some((item) => item.id === 'hotte-aspirante')).toBe(false);
  });

  it('propose les actions de ligne vers l’entretien et les documents', async () => {
    const { push } = await listed();
    await userEvent.click(screen.getByRole('button', { name: 'Autres actions, Hotte aspirante' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Planifier l’entretien' }));
    expect(push).toHaveBeenCalledWith('/biens/equipements/hotte-aspirante/entretien');
  });

  it('exporte la liste filtrée en CSV', async () => {
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:test');
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    await listed();
    await userEvent.click(screen.getByRole('button', { name: 'Exporter' }));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0]?.[0];
    expect(await blob?.text()).toContain('Climatiseur réversible');
  });

  it('affiche une erreur avec reprise quand le chargement échoue', async () => {
    renderBiens(<EquipementsScreen />, { source: failingSource(['equipements']) });
    expect(await screen.findByRole('button', { name: 'Réessayer' })).toBeTruthy();
  });

  it('ne présente aucune violation d’accessibilité', async () => {
    const { container } = await listed();
    await expectNoA11yViolations(container);
  });
});
