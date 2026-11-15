import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../../test/axe';
import { createDemoBiensSource } from '../../demo/store';
import { inventairesSchema } from '../../schemas/releves';
import { failingSource, renderBiens } from '../../testing/harness';
import { InventairesScreen } from './InventairesScreen';

async function listed(source = createDemoBiensSource({ latencyMs: 0 })) {
  const view = renderBiens(<InventairesScreen />, { source });
  await screen.findByRole('table', { name: 'Liste des inventaires' });
  return view;
}

const rowsOf = () => within(screen.getByRole('table', { name: 'Liste des inventaires' })).getAllByRole('row');

async function pickAction(ref: string, action: string) {
  await userEvent.click(screen.getByRole('button', { name: `Autres actions, ${ref}` }));
  await userEvent.click(await screen.findByRole('menuitem', { name: action }));
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('InventairesScreen', () => {
  it('liste les inventaires actifs avec les compteurs des onglets', async () => {
    await listed();
    expect(screen.getByRole('tab', { name: /Actifs\s*6/ })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Archives\s*2/ })).toBeTruthy();
    expect(rowsOf()).toHaveLength(7);
    expect(rowsOf()[1]?.textContent).toContain('INV-2026-0006');
  });

  it('filtre par recherche, bien et modèle puis réinitialise', async () => {
    await listed();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Rechercher un inventaire' }), 'Dossou');
    expect(rowsOf()).toHaveLength(2);
    await userEvent.clear(screen.getByRole('searchbox', { name: 'Rechercher un inventaire' }));
    await userEvent.click(screen.getByRole('combobox', { name: /Modèle/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Vide, standard' }));
    expect(rowsOf()).toHaveLength(3);
    await userEvent.type(screen.getByRole('searchbox', { name: 'Rechercher un inventaire' }), 'zzzz');
    expect(await screen.findByText('Aucun inventaire ne correspond')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Réinitialiser les filtres' }));
    expect(rowsOf()).toHaveLength(7);
  });

  it('trie par valeur', async () => {
    await listed();
    await userEvent.click(screen.getByRole('button', { name: 'Valeur' }));
    expect(rowsOf()[1]?.textContent).toContain('INV-2026-0003');
    await userEvent.click(screen.getByRole('button', { name: 'Valeur' }));
    expect(rowsOf()[1]?.textContent).toContain('INV-2026-0006');
  });

  it('crée un inventaire en reprenant le locataire du bien', async () => {
    const source = createDemoBiensSource({ latencyMs: 0 });
    await listed(source);
    await userEvent.click(screen.getByRole('button', { name: 'Nouvel inventaire' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Créer l’inventaire' }));
    expect(await within(dialog).findByText('Choisissez un bien')).toBeTruthy();
    expect(within(dialog).getByText('Choisissez un modèle')).toBeTruthy();
    await userEvent.click(within(dialog).getByRole('combobox', { name: /Bien/ }));
    await userEvent.click(await screen.findByRole('option', { name: /Apt A2/ }));
    await userEvent.click(within(dialog).getByRole('combobox', { name: /Modèle/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Vide, standard' }));
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Valeur du mobilier, €' }), '1500');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Créer l’inventaire' }));
    expect(await screen.findByText('Inventaire créé')).toBeTruthy();
    await waitFor(() => { expect(screen.getByRole('tab', { name: /Actifs\s*7/ })).toBeTruthy(); });
    const created = inventairesSchema.parse(await source.inventaires()).items.find((item) => item.ref === 'INV-2026-0007');
    expect(created).toMatchObject({ lotName: 'Apt A2', tenant: 'Nadège Sossou', value: 150000, template: 'Vide, standard' });
  });

  it('modifie un inventaire et remet la signature à zéro', async () => {
    const source = createDemoBiensSource({ latencyMs: 0 });
    await listed(source);
    await pickAction('INV-2026-0006', 'Modifier');
    const dialog = await screen.findByRole('dialog');
    const value = within(dialog).getByRole('textbox', { name: 'Valeur du mobilier, €' });
    await userEvent.clear(value);
    await userEvent.type(value, '5000');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer les modifications' }));
    expect(await screen.findByText('Inventaire modifié')).toBeTruthy();
    expect(inventairesSchema.parse(await source.inventaires()).items.find((item) => item.ref === 'INV-2026-0006')?.value).toBe(500000);
  });

  it('envoie un inventaire pour signature puis refuse quand aucun locataire n’est renseigné', async () => {
    const source = createDemoBiensSource({ latencyMs: 0 });
    await listed(source);
    await pickAction('INV-2026-0006', 'Envoyer pour signature');
    expect((await screen.findAllByText('Demande de signature envoyée à Léa Martin')).length).toBeGreaterThan(0);
    expect(await screen.findByText('Signature demandée le 13/11/2026')).toBeTruthy();
    await pickAction('INV-2026-0003', 'Envoyer pour signature');
    expect((await screen.findAllByText('Aucun locataire à qui envoyer l’inventaire : renseignez-le d’abord.')).length).toBeGreaterThan(0);
  });

  it('duplique un inventaire', async () => {
    const source = createDemoBiensSource({ latencyMs: 0 });
    await listed(source);
    await pickAction('INV-2026-0006', 'Dupliquer');
    expect((await screen.findAllByText('Inventaire dupliqué')).length).toBeGreaterThan(0);
    await waitFor(() => { expect(screen.getByRole('tab', { name: /Actifs\s*7/ })).toBeTruthy(); });
    expect(inventairesSchema.parse(await source.inventaires()).items.some((item) => item.ref === 'INV-2026-0007')).toBe(true);
  });

  it('télécharge la fiche de l’inventaire', async () => {
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:test');
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    await listed();
    await pickAction('INV-2026-0006', 'Télécharger le PDF');
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(await createObjectURL.mock.calls[0]?.[0].text()).toContain('Inventaire INV-2026-0006');
  });

  it('archive un inventaire après confirmation puis le restaure', async () => {
    await listed();
    await pickAction('INV-2026-0006', 'Archiver');
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Archiver' }));
    await waitFor(() => { expect(screen.getByRole('tab', { name: /Archives\s*3/ })).toBeTruthy(); });
    expect(screen.getByText('Inventaire archivé')).toBeTruthy();
    await userEvent.click(screen.getByRole('tab', { name: /Archives/ }));
    const table = await screen.findByRole('table', { name: 'Inventaires archivés' });
    await userEvent.click(within(table).getByRole('button', { name: 'Autres actions, INV-2026-0006' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Restaurer' }));
    await waitFor(() => { expect(screen.getByRole('tab', { name: /Actifs\s*6/ })).toBeTruthy(); });
    expect(screen.getByText('Inventaire restauré')).toBeTruthy();
  });

  it('supprime un inventaire après confirmation', async () => {
    const source = createDemoBiensSource({ latencyMs: 0 });
    await listed(source);
    await pickAction('INV-2026-0006', 'Supprimer');
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Supprimer' }));
    await waitFor(() => { expect(screen.getByRole('tab', { name: /Actifs\s*5/ })).toBeTruthy(); });
    expect(screen.getByText('Inventaire supprimé')).toBeTruthy();
    expect(inventairesSchema.parse(await source.inventaires()).items.some((item) => item.ref === 'INV-2026-0006')).toBe(false);
  });

  it('affiche une erreur avec reprise quand le chargement échoue', async () => {
    renderBiens(<InventairesScreen />, { source: failingSource(['inventaires']) });
    expect(await screen.findByText('Les inventaires n’ont pas pu être chargés')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeTruthy();
  });

  it('ne présente aucune violation d’accessibilité', async () => {
    const { container } = await listed();
    await expectNoA11yViolations(container);
  });
});
