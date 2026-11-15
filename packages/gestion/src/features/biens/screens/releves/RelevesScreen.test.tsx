import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../../test/axe';
import { createDemoBiensSource } from '../../demo/store';
import { readingsSchema } from '../../schemas/releves';
import { failingSource, renderBiens } from '../../testing/harness';
import { RelevesScreen } from './RelevesScreen';

async function listed(source = createDemoBiensSource({ latencyMs: 0 })) {
  const view = renderBiens(<RelevesScreen />, { source });
  await screen.findByRole('table', { name: 'Liste des relevés' });
  return view;
}

const rowsOf = () => within(screen.getByRole('table', { name: 'Liste des relevés' })).getAllByRole('row');

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('RelevesScreen', () => {
  it('liste les relevés actifs, les plus récents d’abord, avec leurs compteurs d’onglets', async () => {
    await listed();
    expect(screen.getByRole('tab', { name: /Actifs\s*36/ })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Archives\s*0/ })).toBeTruthy();
    expect(rowsOf()).toHaveLength(11);
    expect(rowsOf()[1]?.textContent).toContain('Électricité PDL 1452 0098 7740');
  });

  it('filtre par recherche, bien, motif et énergie puis réinitialise', async () => {
    await listed();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Rechercher un relevé' }), 'Sossou');
    expect(rowsOf().length).toBeGreaterThan(1);
    expect(rowsOf().slice(1).every((row) => row.textContent.includes('Nadège Sossou'))).toBe(true);
    await userEvent.clear(screen.getByRole('searchbox', { name: 'Rechercher un relevé' }));
    await userEvent.click(screen.getByRole('button', { name: 'Gaz' }));
    expect(rowsOf().slice(1).every((row) => row.textContent.includes('Gaz'))).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: 'Gaz' }));
    await userEvent.click(screen.getByRole('combobox', { name: /Motif/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'En cours de bail' }));
    await userEvent.type(screen.getByRole('searchbox', { name: 'Rechercher un relevé' }), 'zzzz');
    expect(await screen.findByText('Aucun relevé ne correspond')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Réinitialiser les filtres' }));
    expect(rowsOf()).toHaveLength(11);
  });

  it('pagine la liste', async () => {
    await listed();
    await userEvent.click(screen.getByRole('button', { name: 'Suivant' }));
    expect(screen.getByText(/11 à 20 sur 36/)).toBeTruthy();
  });

  it('crée un relevé puis refuse un index inférieur au précédent', async () => {
    const source = createDemoBiensSource({ latencyMs: 0 });
    await listed(source);
    await userEvent.click(screen.getByRole('button', { name: 'Nouveau relevé' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer le relevé' }));
    expect(await within(dialog).findByText('Choisissez un compteur')).toBeTruthy();
    await userEvent.click(within(dialog).getByRole('combobox', { name: /Compteur/ }));
    await userEvent.click(await screen.findByRole('option', { name: /Électricité PDL 1452 0098 7731/ }));
    await userEvent.type(within(dialog).getByLabelText('Date du relevé'), '2026-11-12');
    await userEvent.type(within(dialog).getByRole('textbox', { name: /Index/ }), '10');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer le relevé' }));
    expect((await screen.findAllByText(/L’index doit être supérieur ou égal au relevé précédent/)).length).toBeGreaterThan(0);
    const index = within(dialog).getByRole('textbox', { name: /Index/ });
    await userEvent.clear(index);
    await userEvent.type(index, '9700');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer le relevé' }));
    expect(await screen.findByText('Relevé enregistré')).toBeTruthy();
    await waitFor(() => { expect(screen.getByRole('tab', { name: /Actifs\s*37/ })).toBeTruthy(); });
    expect(readingsSchema.parse(await source.readings()).items.some((item) => item.index === 9700 && item.date === '2026-11-12')).toBe(true);
  });

  it('modifie un relevé avec le compteur verrouillé', async () => {
    const source = createDemoBiensSource({ latencyMs: 0 });
    await listed(source);
    await userEvent.click(screen.getByRole('button', { name: 'Autres actions, Électricité Apt A2' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Modifier' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('combobox', { name: /Compteur/ }).hasAttribute('disabled')).toBe(true);
    const index = within(dialog).getByRole('textbox', { name: /Index/ });
    await userEvent.clear(index);
    await userEvent.type(index, '6250');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer les modifications' }));
    expect(await screen.findByText('Relevé modifié')).toBeTruthy();
    expect(readingsSchema.parse(await source.readings()).items.some((item) => item.index === 6250)).toBe(true);
  });

  it('joint une photo au relevé', async () => {
    const source = createDemoBiensSource({ latencyMs: 0 });
    await listed(source);
    await userEvent.click(screen.getByRole('button', { name: 'Autres actions, Électricité Apt A2' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Joindre une photo' }));
    expect(await screen.findByText('Photo jointe au relevé')).toBeTruthy();
    expect(readingsSchema.parse(await source.readings()).items.filter((item) => item.hasPhoto).length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: 'Autres actions, Électricité Apt A2' }));
    expect((await screen.findByRole('menuitem', { name: 'Joindre une photo' })).getAttribute('aria-disabled')).toBe('true');
  });

  it('archive un relevé après confirmation puis le restaure', async () => {
    await listed();
    await userEvent.click(screen.getByRole('button', { name: 'Autres actions, Électricité Apt A2' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Archiver' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Archiver' }));
    await waitFor(() => { expect(screen.getByRole('tab', { name: /Archives\s*1/ })).toBeTruthy(); });
    expect(screen.getByText('Relevé archivé')).toBeTruthy();
    await userEvent.click(screen.getByRole('tab', { name: /Archives/ }));
    const table = await screen.findByRole('table', { name: 'Relevés archivés' });
    await userEvent.click(within(table).getByRole('button', { name: 'Autres actions, Électricité Apt A2' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Restaurer' }));
    await waitFor(() => { expect(screen.getByRole('tab', { name: /Actifs\s*36/ })).toBeTruthy(); });
    expect(screen.getByText('Relevé restauré')).toBeTruthy();
  });

  it('supprime un relevé après confirmation', async () => {
    const source = createDemoBiensSource({ latencyMs: 0 });
    await listed(source);
    await userEvent.click(screen.getByRole('button', { name: 'Autres actions, Électricité Apt A2' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Supprimer' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Supprimer' }));
    await waitFor(() => { expect(screen.getByRole('tab', { name: /Actifs\s*35/ })).toBeTruthy(); });
    expect(screen.getByText('Relevé supprimé')).toBeTruthy();
    expect(readingsSchema.parse(await source.readings()).items).toHaveLength(35);
  });

  it('exporte les relevés en CSV', async () => {
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:test');
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    await listed();
    await userEvent.click(screen.getByRole('button', { name: 'Exporter' }));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(await createObjectURL.mock.calls[0]?.[0].text()).toContain('Compteur;Bien;Locataire');
  });

  it('affiche une erreur avec reprise quand le chargement échoue', async () => {
    renderBiens(<RelevesScreen />, { source: failingSource(['readings']) });
    expect(await screen.findByText('Les relevés n’ont pas pu être chargés')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeTruthy();
  });

  it('ne présente aucune violation d’accessibilité', async () => {
    const { container } = await listed();
    await expectNoA11yViolations(container);
  });
});
