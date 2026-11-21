import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../../../test/axe';
import { norm } from '../../../../../test/lots';
import type { MockRoute } from '../api/testing';
import { ownerFundsPaths } from '../paths';
import { orgUrl, ownerFundsUrl, renderOwnerFunds } from '../testing';
import { SIM_IDS, mandatesEmpty, mandatesPage, problemAmountTooHigh, problemFeeBaseMissing, problemMandateNotFound, problemRateLimited, simulation, simulationEmpty, simulationWithoutCurrent } from './fixtures';
import { SimulationPage } from './SimulationPage';

const SLOW = { timeout: 4000 };
const simulateUrl = ownerFundsUrl('/fees/simulations');
const mandatesUrl = orgUrl('/mandates');

const routes = (extra: Record<string, MockRoute> = {}): Record<string, MockRoute> => ({
  [`GET ${mandatesUrl}`]: { body: mandatesPage() },
  [`POST ${simulateUrl}`]: { body: simulation },
  ...extra,
});

async function chooseMandate(label: RegExp) {
  await userEvent.click(await screen.findByRole('combobox', { name: /Mandat/ }, SLOW));
  await userEvent.click(await screen.findByRole('option', { name: label }));
}

const rowsOf = (table: HTMLElement) => within(table).getAllByRole('row').slice(1).map((row) => norm(row.textContent));

describe('simulation du barème', () => {
  it('préremplit le barème du mandat choisi, simule et affiche mois par mois avec totaux', async () => {
    const { container, callsTo } = renderOwnerFunds(<SimulationPage />, routes());
    await chooseMandate(/M-2026-0001/);
    expect(screen.getByLabelText<HTMLInputElement>('Taux, % *').value).toBe('8');
    await userEvent.clear(screen.getByLabelText('Taux, % *'));
    await userEvent.type(screen.getByLabelText('Taux, % *'), '7,5');
    await userEvent.type(screen.getByLabelText('Minimum mensuel'), '50');
    await userEvent.click(screen.getByRole('button', { name: 'Simuler le barème' }));

    const table = await screen.findByRole('table', { name: 'Simulation des honoraires mois par mois' }, SLOW);
    expect(callsTo('POST', simulateUrl)[0]?.body).toEqual({
      mandate_id: SIM_IDS.mandateA,
      fee_kind: 'percentage',
      fee_basis_points: 750,
      fee_base: 'rent',
      fee_minimum_amount: 5000,
      fee_tax_mode: 'excl_tax',
      months: 3,
    });
    const rows = rowsOf(table);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toContain('Août 2026');
    expect(rows[0]).toContain('115,20 €');
    expect(rows[0]).toContain('108 €');
    expect(rows[0]).toMatch(/[-−]7,20 €/);
    expect(rows[2]).toContain('Minimum appliqué');
    expect(rows[2]).toContain('+21,60 €');
    const totals = within(screen.getByRole('region', { name: 'Totaux de la simulation' }));
    expect(norm(totals.getByText('Honoraires simulés TTC').nextElementSibling?.textContent)).toBe('276 €');
    expect(norm(totals.getByText('Écart TTC').nextElementSibling?.textContent)).toBe('+7,20 €');
    await expectNoA11yViolations(container);
  });

  it('préremplit un forfait en francs CFA sans décimale et l’envoie en entier', async () => {
    const { callsTo } = renderOwnerFunds(<SimulationPage />, routes());
    await chooseMandate(/M-2026-0002/);
    expect(screen.getByLabelText<HTMLInputElement>('Forfait mensuel *').value).toBe('50000');
    await userEvent.click(screen.getByRole('button', { name: 'Simuler le barème' }));
    await screen.findByRole('table', { name: 'Simulation des honoraires mois par mois' }, SLOW);
    expect(callsTo('POST', simulateUrl)[0]?.body).toMatchObject({ fee_kind: 'flat', fee_flat_amount: 50000, fee_minimum_amount: 25000, fee_base: 'rent_and_charges', fee_tax_mode: 'incl_tax' });
    expect(callsTo('POST', simulateUrl)[0]?.body).not.toHaveProperty('fee_basis_points');
  });

  it('refuse de simuler sans mandat ni base sans appeler le serveur', async () => {
    const { callsTo } = renderOwnerFunds(<SimulationPage />, routes());
    await userEvent.click(await screen.findByRole('button', { name: 'Simuler le barème' }, SLOW));
    expect(await screen.findByText('Choisissez un mandat.')).toBeTruthy();
    expect(screen.getByText(/Choisissez la base de calcul/)).toBeTruthy();
    expect(callsTo('POST', simulateUrl)).toHaveLength(0);
  });

  it('présélectionne le mandat de l’adresse', async () => {
    renderOwnerFunds(<SimulationPage />, routes(), { search: `mandat=${SIM_IDS.mandateB}` });
    expect((await screen.findByLabelText<HTMLInputElement>('Forfait mensuel *', undefined, SLOW)).value).toBe('50000');
    const link = screen.getByRole('link', { name: 'Passer un avenant' });
    expect(link.getAttribute('href')).toBe(`${ownerFundsPaths.amendment}?mandat=${SIM_IDS.mandateB}`);
  });

  it('indique l’absence de mois clos avec un lien vers la clôture', async () => {
    renderOwnerFunds(<SimulationPage />, routes({ [`POST ${simulateUrl}`]: { body: simulationEmpty } }));
    await chooseMandate(/M-2026-0001/);
    await userEvent.click(screen.getByRole('button', { name: 'Simuler le barème' }));
    expect(await screen.findByText('Aucun mois clos à simuler', undefined, SLOW)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ouvrir la clôture mensuelle' }).getAttribute('href')).toBe(ownerFundsPaths.closing);
    expect(screen.queryByRole('table', { name: /mois par mois/ })).toBeNull();
  });

  it('affiche « Non calculable » quand le barème en vigueur n’a pas de base', async () => {
    renderOwnerFunds(<SimulationPage />, routes({ [`POST ${simulateUrl}`]: { body: simulationWithoutCurrent } }));
    await chooseMandate(/M-2026-0001/);
    await userEvent.click(screen.getByRole('button', { name: 'Simuler le barème' }));
    const table = await screen.findByRole('table', { name: /mois par mois/ }, SLOW);
    expect(rowsOf(table)[0]).toContain('Non calculable');
    expect(screen.getByText(/ne sont pas calculables sur tous les mois/)).toBeTruthy();
    expect(screen.getByText('Seuls 1 mois clos sont disponibles sur les 3 demandés.')).toBeTruthy();
  });

  it('affiche l’erreur du plafond sous le champ concerné', async () => {
    renderOwnerFunds(<SimulationPage />, routes({ [`POST ${simulateUrl}`]: { status: 422, body: problemAmountTooHigh } }));
    await chooseMandate(/M-2026-0002/);
    await userEvent.click(screen.getByRole('button', { name: 'Simuler le barème' }));
    const field = await screen.findByLabelText('Forfait mensuel *', undefined, SLOW);
    await waitFor(() => { expect(field.getAttribute('aria-invalid')).toBe('true'); });
    expect(norm(document.body.textContent)).toContain('ne peut pas dépasser 100 000 000 000');
  });

  it('rattache fee_base_missing au champ base', async () => {
    renderOwnerFunds(<SimulationPage />, routes({ [`POST ${simulateUrl}`]: { status: 422, body: problemFeeBaseMissing } }));
    await chooseMandate(/M-2026-0001/);
    await userEvent.click(screen.getByRole('button', { name: 'Simuler le barème' }));
    expect(await screen.findByText('Choisissez la base de calcul des honoraires.', undefined, SLOW)).toBeTruthy();
  });

  it.each([
    ['404', 404, problemMandateNotFound, 'Ce mandat n’existe pas dans votre organisation'],
    ['429', 429, problemRateLimited, 'Trop de requêtes en peu de temps'],
  ] as const)('affiche l’erreur %s avec un bouton Réessayer qui relance la même proposition', async (_label, status, body, message) => {
    let attempts = 0;
    const { callsTo } = renderOwnerFunds(<SimulationPage />, routes({ [`POST ${simulateUrl}`]: () => (attempts++ === 0 ? { status, body } : { body: simulation }) }));
    await chooseMandate(/M-2026-0001/);
    await userEvent.click(screen.getByRole('button', { name: 'Simuler le barème' }));
    const alert = await screen.findByRole('alert', undefined, SLOW);
    expect(norm(alert.textContent)).toContain(message);
    await userEvent.click(within(alert).getByRole('button', { name: 'Réessayer' }));
    await screen.findByRole('table', { name: /mois par mois/ }, SLOW);
    const bodies = callsTo('POST', simulateUrl).map((call) => call.body);
    expect(bodies).toHaveLength(2);
    expect(bodies[1]).toEqual(bodies[0]);
  });

  it('affiche l’erreur de chargement des mandats avec Réessayer', async () => {
    let attempts = 0;
    renderOwnerFunds(<SimulationPage />, routes({ [`GET ${mandatesUrl}`]: () => (attempts++ === 0 ? { status: 503, body: { type: 'about:blank', title: 'x', status: 503, detail: 'x', code: 'unavailable' } } : { body: mandatesPage() }) }));
    const alert = await screen.findByRole('alert', undefined, SLOW);
    expect(norm(alert.textContent)).toContain('Les mandats n’ont pas pu être chargés');
    await userEvent.click(within(alert).getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByRole('combobox', { name: /Mandat/ }, SLOW)).toBeTruthy();
  });

  it('propose de voir les mandats quand aucun n’est actif', async () => {
    renderOwnerFunds(<SimulationPage />, routes({ [`GET ${mandatesUrl}`]: { body: mandatesEmpty } }));
    expect(await screen.findByText('Aucun mandat actif', undefined, SLOW)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Voir les mandats' }).getAttribute('href')).toBe('/mandats');
  });

  it('reste fermé aux organisations qui ne sont pas des agences', async () => {
    const { callsTo } = renderOwnerFunds(<SimulationPage />, routes(), { kind: 'individual' });
    expect(await screen.findByText('Fonds des mandants indisponibles pour ce compte', undefined, SLOW)).toBeTruthy();
    expect(callsTo('GET', mandatesUrl)).toHaveLength(0);
  });
});
