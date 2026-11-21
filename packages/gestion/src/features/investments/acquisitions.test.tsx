import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { AcquisitionsPage } from './AcquisitionsPage';
import * as api from './api/fixtures';
import { investmentsUrl, problem, renderInvestments } from './testing';

const SLOW = { timeout: 4000 };

async function firstButton(name: string): Promise<HTMLElement> {
  const [first] = await screen.findAllByRole('button', { name }, SLOW);
  if (first === undefined) throw new Error(`Bouton introuvable : ${name}`);
  return first;
}
const list = `GET ${investmentsUrl('/acquisitions')}`;

describe('coût de revient des biens', () => {
  it('affiche le coût de revient fourni par le serveur', async () => {
    const { container } = renderInvestments(<AcquisitionsPage />, { [list]: { body: { data: [api.acquisition] } } });
    const table = await screen.findByRole('table', {}, SLOW);
    expect(table.textContent).toContain('Résidence des Lilas');
    expect(table.textContent).toContain('230');
    expect(table.textContent).toContain('10/01/2025');
    await expectNoA11yViolations(container);
  });

  it('propose l’état vide et explique que l’absence n’est pas un zéro', async () => {
    renderInvestments(<AcquisitionsPage />, { [list]: { body: { data: [] } } });
    expect(await screen.findByText('Aucun coût de revient', {}, SLOW)).toBeTruthy();
    expect(screen.getByText(/jamais comme nulle/)).toBeTruthy();
  });

  it('gère une erreur serveur avec Réessayer', async () => {
    renderInvestments(<AcquisitionsPage />, { [list]: problem(500, 'server_error') });
    expect(await screen.findByRole('button', { name: 'Réessayer' }, SLOW)).toBeTruthy();
  });

  it('modifie un coût avec la version lue et affiche le 409', async () => {
    const patch = `PATCH ${investmentsUrl(`/acquisitions/${api.IDS.acquisition}`)}`;
    const { callsTo } = renderInvestments(<AcquisitionsPage />, { [list]: { body: { data: [api.acquisition] } }, [patch]: problem(409, 'loan_version_conflict') });
    await userEvent.click(await screen.findByRole('button', { name: 'Modifier' }, SLOW));
    const dialog = await screen.findByRole('dialog');
    const price = within(dialog).getByLabelText(/Prix d’achat/);
    await userEvent.clear(price);
    await userEvent.type(price, '210000');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer' }));
    expect(await within(dialog).findByText(/modifié depuis votre lecture/, {}, SLOW)).toBeTruthy();
    expect(callsTo('PATCH', investmentsUrl(`/acquisitions/${api.IDS.acquisition}`))[0]?.body).toMatchObject({ price: 21_000_000, lock_version: 1 });
  });

  it('crée un coût de revient avec une clé d’idempotence', async () => {
    const { callsTo } = renderInvestments(<AcquisitionsPage />, { [list]: { body: { data: [] } }, [`POST ${investmentsUrl('/acquisitions')}`]: { status: 201, body: { data: api.acquisition } } });
    await userEvent.click(await firstButton('Ajouter un coût de revient'));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('combobox', { name: /Bien acquis/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Résidence des Lilas' }));
    await userEvent.type(within(dialog).getByLabelText(/Date d’acquisition/), '2025-01-10');
    await userEvent.type(within(dialog).getByLabelText(/Prix d’achat/), '200000');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Ajouter' }));
    await waitFor(() => { expect(callsTo('POST', investmentsUrl('/acquisitions'))).toHaveLength(1); }, SLOW);
    const call = callsTo('POST', investmentsUrl('/acquisitions'))[0];
    expect(call?.body).toMatchObject({ property_id: api.IDS.property, price: 20_000_000, acquired_on: '2025-01-10' });
    expect(call?.headers.get('Idempotency-Key')).toMatch(/^ui-/);
  });

  it('n’offre aucune modification à un rôle en lecture seule', async () => {
    renderInvestments(<AcquisitionsPage />, { [list]: { body: { data: [api.acquisition] } } }, { role: 'manager' });
    await screen.findByRole('table', {}, SLOW);
    expect(screen.queryByRole('button', { name: 'Modifier' })).toBeNull();
  });
});
