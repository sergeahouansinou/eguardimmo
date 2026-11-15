import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../../../test/axe';
import { createDemoBiensSource } from '../../demo/store';
import { immeubleDetailSchema } from '../../schemas/immeubles';
import { failingSource, renderBiens } from '../../testing/harness';
import { ImmeubleForm } from './ImmeubleForm';

async function fillNew(name: string) {
  await userEvent.type(await screen.findByRole('textbox', { name: 'Nom de l’immeuble *' }), name);
  await userEvent.type(screen.getByRole('textbox', { name: 'Adresse *' }), '4 rue Neuve');
  await userEvent.type(screen.getByRole('textbox', { name: 'Code postal *' }), '31000');
  await userEvent.type(screen.getByRole('textbox', { name: 'Ville *' }), 'Toulouse');
}

describe('ImmeubleForm', () => {
  it('crée un immeuble et redirige vers sa fiche', async () => {
    const { push, source } = renderBiens(<ImmeubleForm />, { pathname: '/biens/immeubles/nouveau' });
    await fillNew('Villa Neuve');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer l’immeuble' }));
    await waitFor(() => { expect(push).toHaveBeenCalledWith('/biens/immeubles/villa-neuve'); });
    expect(await screen.findByText('Immeuble « Villa Neuve » créé')).toBeTruthy();
    const created = immeubleDetailSchema.parse(await source.immeuble('villa-neuve'));
    expect(created?.values).toMatchObject({ name: 'Villa Neuve', city: 'Toulouse', country: 'France', repartition: 'tantiemes' });
  });

  it('signale les champs obligatoires sans rien enregistrer', async () => {
    const { push } = renderBiens(<ImmeubleForm />, { pathname: '/biens/immeubles/nouveau' });
    await userEvent.click(await screen.findByRole('button', { name: 'Enregistrer l’immeuble' }));
    expect((await screen.findAllByText('Champ requis')).length).toBeGreaterThanOrEqual(3);
    expect(push).not.toHaveBeenCalled();
  });

  it('remonte le refus du serveur pour un nom déjà pris', async () => {
    const { push } = renderBiens(<ImmeubleForm />, { pathname: '/biens/immeubles/nouveau' });
    await fillNew('Les Tilleuls');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer l’immeuble' }));
    expect(await screen.findByText('Un immeuble nommé « Les Tilleuls » existe déjà.')).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });

  it('modifie un immeuble existant, préremplit le formulaire et redirige', async () => {
    const source = createDemoBiensSource({ latencyMs: 0 });
    const { push } = renderBiens(<ImmeubleForm id="maison-riviere" />, { source, pathname: '/biens/immeubles/maison-riviere/modifier' });
    const city = await screen.findByRole<HTMLInputElement>('textbox', { name: 'Ville *' });
    expect(city.value).toBe('Bordeaux');
    await userEvent.clear(city);
    await userEvent.type(city, 'Mérignac');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer les modifications' }));
    await waitFor(() => { expect(push).toHaveBeenCalledWith('/biens/immeubles/maison-riviere'); });
    expect(immeubleDetailSchema.parse(await source.immeuble('maison-riviere'))?.values.city).toBe('Mérignac');
  });

  it('indique un immeuble introuvable', async () => {
    renderBiens(<ImmeubleForm id="fantome" />);
    expect(await screen.findByText('Cet immeuble est introuvable')).toBeTruthy();
  });

  it('affiche une erreur quand le chargement échoue', async () => {
    renderBiens(<ImmeubleForm id="les-tilleuls" />, { source: failingSource(['immeuble']) });
    expect(await screen.findByText('L’immeuble n’a pas pu être chargé')).toBeTruthy();
  });

  it('ne présente aucune violation d’accessibilité', async () => {
    const { container } = renderBiens(<ImmeubleForm />, { pathname: '/biens/immeubles/nouveau' });
    await screen.findByRole('textbox', { name: 'Nom de l’immeuble *' });
    await expectNoA11yViolations(container);
  });
});
