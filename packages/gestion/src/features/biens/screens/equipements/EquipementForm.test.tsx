import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../../../test/axe';
import { createDemoBiensSource } from '../../demo/store';
import { equipementDetailSchema } from '../../schemas/equipements';
import { failingSource, renderBiens } from '../../testing/harness';
import { EquipementForm } from './EquipementForm';

async function fillNew() {
  await userEvent.type(await screen.findByRole('textbox', { name: 'Nom de l’équipement *' }), 'Radiateur soufflant');
  await userEvent.click(screen.getByRole('combobox', { name: /Famille/ }));
  await userEvent.click(await screen.findByRole('option', { name: 'Chauffage et eau chaude' }));
  await userEvent.click(screen.getByRole('combobox', { name: /Bien ou parties communes/ }));
  await userEvent.click(await screen.findByRole('option', { name: /Apt A2/ }));
}

describe('EquipementForm', () => {
  it('crée un équipement rattaché à un lot et redirige vers sa fiche', async () => {
    const { push, source } = renderBiens(<EquipementForm />, { pathname: '/biens/equipements/nouveau' });
    await fillNew();
    await userEvent.type(screen.getByRole('textbox', { name: 'Prix d’achat, €' }), '89,90');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer l’équipement' }));
    await waitFor(() => { expect(push).toHaveBeenCalledWith('/biens/equipements/radiateur-soufflant'); });
    expect(await screen.findByText('Équipement « Radiateur soufflant » ajouté')).toBeTruthy();
    const created = equipementDetailSchema.parse(await source.equipement('radiateur-soufflant'));
    expect(created?.values).toMatchObject({ name: 'Radiateur soufflant', family: 'chauffage', lotId: 'apt-a2', price: 8990 });
  });

  it('signale les champs obligatoires sans rien enregistrer', async () => {
    const { push } = renderBiens(<EquipementForm />, { pathname: '/biens/equipements/nouveau' });
    await userEvent.click(await screen.findByRole('button', { name: 'Enregistrer l’équipement' }));
    expect((await screen.findAllByText('Champ requis')).length).toBeGreaterThanOrEqual(1);
    expect(await screen.findByText('Choisissez où se trouve l’équipement')).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });

  it('refuse une garantie qui finit avant l’achat', async () => {
    const { push } = renderBiens(<EquipementForm />, { pathname: '/biens/equipements/nouveau' });
    await fillNew();
    await userEvent.type(screen.getByLabelText('Date d’achat'), '2026-05-01');
    await userEvent.type(screen.getByLabelText('Fin de garantie'), '2026-01-01');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer l’équipement' }));
    expect(await screen.findByText('La garantie finit avant l’achat')).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });

  it('modifie un équipement existant avec son formulaire prérempli', async () => {
    const source = createDemoBiensSource({ latencyMs: 0 });
    const { push } = renderBiens(<EquipementForm id="climatiseur-reversible" />, { source, pathname: '/biens/equipements/climatiseur-reversible/modifier' });
    const brand = await screen.findByRole<HTMLInputElement>('textbox', { name: 'Marque' });
    expect(brand.value).toBe('Thermea');
    await userEvent.clear(brand);
    await userEvent.type(brand, 'Atlantic');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer les modifications' }));
    await waitFor(() => { expect(push).toHaveBeenCalledWith('/biens/equipements/climatiseur-reversible'); });
    expect(equipementDetailSchema.parse(await source.equipement('climatiseur-reversible'))?.values.brand).toBe('Atlantic');
  });

  it('indique un équipement introuvable', async () => {
    renderBiens(<EquipementForm id="fantome" />);
    expect(await screen.findByText('Cet équipement est introuvable')).toBeTruthy();
  });

  it('affiche une erreur quand le chargement échoue', async () => {
    renderBiens(<EquipementForm id="climatiseur-reversible" />, { source: failingSource(['equipement']) });
    expect(await screen.findByRole('button', { name: 'Réessayer' })).toBeTruthy();
  });

  it('ne présente aucune violation d’accessibilité', async () => {
    const { container } = renderBiens(<EquipementForm />, { pathname: '/biens/equipements/nouveau' });
    await screen.findByRole('textbox', { name: 'Nom de l’équipement *' });
    await expectNoA11yViolations(container);
  });
});
