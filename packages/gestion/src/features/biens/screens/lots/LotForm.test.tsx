import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../../../test/axe';
import { createDemoBiensSource } from '../../demo/store';
import { lotDetailSchema } from '../../schemas/lots';
import { failingSource, renderBiens } from '../../testing/harness';
import { LotForm } from './LotForm';

async function fillNewLot() {
  await userEvent.type(await screen.findByRole('textbox', { name: 'Nom du lot *' }), 'Apt E5');
  await userEvent.click(screen.getByRole('combobox', { name: /Immeuble/ }));
  await userEvent.click(await screen.findByRole('option', { name: /Les Tilleuls/ }));
  await userEvent.type(screen.getByRole('textbox', { name: 'Surface, m² *' }), '48,5');
  await userEvent.type(screen.getByRole('textbox', { name: 'Loyer mensuel, € *' }), '800');
}

describe('LotForm', () => {
  it('crée un lot, préremplit l’adresse de l’immeuble et redirige vers la fiche', async () => {
    const { push, source } = renderBiens(<LotForm />, { pathname: '/biens/nouveau' });
    await fillNewLot();
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Adresse *' }).value).toBe('12 rue des Lilas');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le lot' }));
    await waitFor(() => { expect(push).toHaveBeenCalledWith('/biens/apt-e5'); });
    expect(await screen.findByText('Lot « Apt E5 » créé')).toBeTruthy();
    const created = lotDetailSchema.parse(await source.lot('apt-e5'));
    expect(created?.lot).toMatchObject({ name: 'Apt E5', surface: 48.5, rent: 80000, immeubleId: 'les-tilleuls' });
  });

  it('enchaîne avec un nouveau lot quand on choisit « ajouter un autre »', async () => {
    const { push } = renderBiens(<LotForm />, { pathname: '/biens/nouveau' });
    await fillNewLot();
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer et ajouter un autre' }));
    expect(await screen.findByText('Lot « Apt E5 » créé')).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
    await waitFor(() => { expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Nom du lot *' }).value).toBe(''); });
  });

  it('signale les champs obligatoires et les valeurs invalides sans rien enregistrer', async () => {
    const { push, source } = renderBiens(<LotForm />, { pathname: '/biens/nouveau' });
    await userEvent.click(await screen.findByRole('button', { name: 'Enregistrer le lot' }));
    expect((await screen.findAllByText('Champ requis')).length).toBeGreaterThanOrEqual(3);
    await userEvent.type(screen.getByRole('textbox', { name: 'Surface, m² *' }), 'abc');
    expect(await screen.findByText('Surface invalide')).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
    const lots = (await source.lots()) as { items: unknown[] };
    expect(lots.items).toHaveLength(16);
  });

  it('remonte le refus du serveur pour un nom déjà utilisé dans l’immeuble', async () => {
    const { push } = renderBiens(<LotForm />, { pathname: '/biens/nouveau' });
    await userEvent.type(await screen.findByRole('textbox', { name: 'Nom du lot *' }), 'Apt A1');
    await userEvent.click(screen.getByRole('combobox', { name: /Immeuble/ }));
    await userEvent.click(await screen.findByRole('option', { name: /Les Tilleuls/ }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Surface, m² *' }), '40');
    await userEvent.type(screen.getByRole('textbox', { name: 'Loyer mensuel, € *' }), '700');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le lot' }));
    expect(await screen.findByText('Un bien nommé « Apt A1 » existe déjà dans cet immeuble.')).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });

  it('modifie un lot existant à partir de ses valeurs', async () => {
    const source = createDemoBiensSource({ latencyMs: 0 });
    const { push } = renderBiens(<LotForm id="apt-a1" />, { source, pathname: '/biens/apt-a1/modifier' });
    const name = await screen.findByRole('textbox', { name: 'Nom du lot *' });
    expect((name as HTMLInputElement).value).toBe('Apt A1');
    await userEvent.clear(name);
    await userEvent.type(name, 'Apt A1 bis');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer les modifications' }));
    await waitFor(() => { expect(push).toHaveBeenCalledWith('/biens/apt-a1'); });
    expect(lotDetailSchema.parse(await source.lot('apt-a1'))?.lot.name).toBe('Apt A1 bis');
  });

  it('enregistre un parking sans surface mais exige la surface d’un appartement', async () => {
    const { push, source } = renderBiens(<LotForm />, { pathname: '/biens/nouveau' });
    await userEvent.type(await screen.findByRole('textbox', { name: 'Nom du lot *' }), 'Parking P9');
    await userEvent.click(screen.getByRole('combobox', { name: /Immeuble/ }));
    await userEvent.click(await screen.findByRole('option', { name: /Les Tilleuls/ }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Loyer mensuel, € *' }), '60');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le lot' }));
    expect(await screen.findByText('Champ requis')).toBeTruthy();
    expect(push).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('combobox', { name: /Type/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Parking' }));
    expect(screen.getByRole('textbox', { name: 'Surface, m²' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le lot' }));
    await waitFor(() => { expect(push).toHaveBeenCalledWith('/biens/parking-p9'); });
    expect(lotDetailSchema.parse(await source.lot('parking-p9'))?.lot).toMatchObject({ name: 'Parking P9', type: 'parking' });
  });

  it('indique qu’un lot est introuvable', async () => {
    renderBiens(<LotForm id="fantome" />, { pathname: '/biens/fantome/modifier' });
    expect(await screen.findByText('Ce lot est introuvable')).toBeTruthy();
  });

  it('affiche une erreur quand les immeubles ne se chargent pas', async () => {
    renderBiens(<LotForm />, { source: failingSource(['immeubles']), pathname: '/biens/nouveau' });
    expect(await screen.findByText('Les immeubles n’ont pas pu être chargés')).toBeTruthy();
  });

  it('ne présente aucune violation d’accessibilité', async () => {
    const { container } = renderBiens(<LotForm />, { pathname: '/biens/nouveau' });
    await screen.findByRole('textbox', { name: 'Nom du lot *' });
    await expectNoA11yViolations(container);
  });
});
