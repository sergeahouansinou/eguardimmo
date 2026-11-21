import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { LoansPage } from './LoansPage';
import * as api from './api/fixtures';
import { investmentsUrl, problem, renderInvestments } from './testing';

const SLOW = { timeout: 4000 };

async function firstButton(name: string): Promise<HTMLElement> {
  const [first] = await screen.findAllByRole('button', { name }, SLOW);
  if (first === undefined) throw new Error(`Bouton introuvable : ${name}`);
  return first;
}
const list = `GET ${investmentsUrl('/loans')}`;
const create = `POST ${investmentsUrl('/loans')}`;

describe('liste des prêts (bailleur autonome)', () => {
  it('affiche les prêts avec le restant dû selon l’échéancier daté, sans libellé de solde', async () => {
    const { container, calls } = renderInvestments(<LoansPage />, { [list]: { body: { data: [api.loanBase, api.loanTwo] } } });
    const table = await screen.findByRole('table', {}, SLOW);

    expect(within(table).getByRole('link', { name: 'Banque Populaire' }).getAttribute('href')).toBe(`/finances/prets/${api.IDS.loan}`);
    expect(table.textContent).toContain('138');
    expect(table.textContent).toContain('au 21/11/2026');
    expect(table.textContent).toContain('3,45 %');
    expect(table.textContent).toContain('Saisie annulée');
    expect(screen.getByText(/jamais un solde comptable/)).toBeTruthy();
    expect(calls.some((call) => call.path === investmentsUrl('/loans'))).toBe(true);
    await expectNoA11yViolations(container);
  });

  it('propose l’état vide avec l’action de création', async () => {
    renderInvestments(<LoansPage />, { [list]: { body: { data: [] } } });
    expect(await screen.findByText('Aucun prêt enregistré', {}, SLOW)).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Nouveau prêt' }).length).toBeGreaterThan(0);
  });

  it('masque la création pour un rôle en lecture seule et l’explique', async () => {
    renderInvestments(<LoansPage />, { [list]: { body: { data: [api.loanBase] } } }, { role: 'manager' });
    await screen.findByRole('table', {}, SLOW);
    await screen.findByText('Consultation seulement', {}, SLOW);
    expect(screen.queryByRole('button', { name: 'Nouveau prêt' })).toBeNull();
  });

  it('refuse l’écran à une agence sans appeler le serveur', async () => {
    const { calls } = renderInvestments(<LoansPage />, {}, { kind: 'agency' });
    expect(await screen.findByText('Réservé aux bailleurs autonomes', {}, SLOW)).toBeTruthy();
    expect(calls).toHaveLength(0);
  });

  it('gère le refus 403 du serveur', async () => {
    renderInvestments(<LoansPage />, { [list]: problem(403, 'investments_landlord_only', 'x') });
    expect(await screen.findByText('Accès refusé', {}, SLOW)).toBeTruthy();
  });

  it('gère la limite de débit 429 avec Réessayer', async () => {
    renderInvestments(<LoansPage />, { [list]: problem(429, 'too_many_requests', 'x', {}) });
    expect(await screen.findByText(/Impossible de charger les prêts/, {}, SLOW)).toBeTruthy();
    expect(screen.getByText(/Trop de requêtes/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeTruthy();
  });

  it('crée un prêt : montants en unités mineures, taux en texte, clé d’idempotence', async () => {
    const { callsTo } = renderInvestments(<LoansPage />, { [list]: { body: { data: [] } }, [create]: { status: 201, body: { data: api.loanBase } } });
    await userEvent.click(await firstButton('Nouveau prêt'));
    const dialog = await screen.findByRole('dialog');

    await userEvent.click(await within(dialog).findByRole('combobox', { name: /Bien financé/ }, SLOW));
    await userEvent.click(await screen.findByRole('option', { name: 'Résidence des Lilas' }));
    await userEvent.type(within(dialog).getByLabelText(/Prêteur/), 'Banque Populaire');
    await userEvent.type(within(dialog).getByLabelText(/Capital emprunté/), '150000');
    await userEvent.type(within(dialog).getByLabelText(/Taux nominal/), '3,45');
    await userEvent.type(within(dialog).getByLabelText(/Première échéance/), '2025-02-05');
    await userEvent.type(within(dialog).getByLabelText(/Durée \(mois\)/), '240');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer le prêt' }));

    await waitFor(() => { expect(callsTo('POST', investmentsUrl('/loans'))).toHaveLength(1); }, SLOW);
    const call = callsTo('POST', investmentsUrl('/loans'))[0];
    expect(call?.body).toMatchObject({ property_id: api.IDS.property, lender_label: 'Banque Populaire', principal: 15_000_000, nominal_rate: '3.45', term_months: 240, first_due_on: '2025-02-05' });
    expect(call?.headers.get('Idempotency-Key')).toMatch(/^ui-/);
  });

  it('affiche l’erreur 422 du serveur dans le dialogue sans le fermer', async () => {
    renderInvestments(<LoansPage />, { [list]: { body: { data: [] } }, [create]: problem(422, 'loan_terms_invalid', 'Le différé dépasse la durée du prêt.') });
    await userEvent.click(await firstButton('Nouveau prêt'));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(await within(dialog).findByRole('combobox', { name: /Bien financé/ }, SLOW));
    await userEvent.click(await screen.findByRole('option', { name: 'Résidence des Lilas' }));
    await userEvent.type(within(dialog).getByLabelText(/Prêteur/), 'Banque Populaire');
    await userEvent.type(within(dialog).getByLabelText(/Capital emprunté/), '150000');
    await userEvent.type(within(dialog).getByLabelText(/Taux nominal/), '3.45');
    await userEvent.type(within(dialog).getByLabelText(/Première échéance/), '2025-02-05');
    await userEvent.type(within(dialog).getByLabelText(/Durée \(mois\)/), '240');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer le prêt' }));
    expect(await within(dialog).findByText(/Le différé dépasse la durée du prêt/, {}, SLOW)).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});
