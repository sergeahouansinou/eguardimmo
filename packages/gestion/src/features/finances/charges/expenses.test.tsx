import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import { norm } from '../../../../test/lots';
import * as api from './api/responses.fixtures';
import { ExpenseDetailPage } from './ExpenseDetailPage';
import { ExpensesPage } from './ExpensesPage';
import { saveBlob } from '../rent/download';
import { PROOF_ROUTE, chargesUrl, problem, renderCharges, twice } from './testing';

vi.mock('../rent/download', () => ({ saveBlob: vi.fn() }));

const SLOW = { timeout: 4000 };
const listUrl = chargesUrl('/expenses');
const detailUrl = (id: string) => chargesUrl(`/expenses/${id}`);

async function listTable() {
  const found = await screen.findByRole('table', { name: 'Dépenses' }, SLOW);
  await waitFor(() => { expect(within(found).getAllByText('Société Propreté Plus').length).toBeGreaterThan(0); }, SLOW);
  return found;
}

describe('liste des dépenses', () => {
  it('affiche les dépenses du serveur avec montants, règlement et statut', async () => {
    const { container, calls } = renderCharges(<ExpensesPage />, { [`GET ${listUrl}`]: { body: api.page([api.expense, api.expensePending]) } });
    const table = await listTable();
    const text = norm(table.textContent);

    expect(text).toContain('1 200 €');
    expect(text).toContain('Banque');
    expect(text).toContain('En attente de validation');
    expect(text).toContain('Entretien');
    expect(screen.getByRole('link', { name: 'Nouvelle dépense' }).getAttribute('href')).toBe('/finances/depenses/nouvelle');
    expect(calls.some((call) => call.path === listUrl && call.search.get('per_page') !== null)).toBe(true);
    await expectNoA11yViolations(container);
  });

  it('transmet les filtres au serveur et revient à la première page', async () => {
    const { calls } = renderCharges(<ExpensesPage />, { [`GET ${listUrl}`]: { body: api.page([api.expense], 'suite') } });
    await listTable();
    await userEvent.click(screen.getByRole('button', { name: 'Suivant' }));
    await waitFor(() => { expect(calls.some((call) => call.search.get('cursor') === 'suite')).toBe(true); }, SLOW);

    await userEvent.click(screen.getByRole('combobox', { name: /Statut/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Annulée' }));

    await waitFor(() => { expect(calls.some((call) => call.search.get('status') === 'cancelled' && call.search.get('cursor') === null)).toBe(true); }, SLOW);
  });

  it('explique l’absence de dépense et l’échec de chargement', async () => {
    renderCharges(<ExpensesPage />, { [`GET ${listUrl}`]: { body: api.page([]) } });
    expect(await screen.findByText(/Aucune dépense enregistrée/, {}, SLOW)).toBeTruthy();
  });

  it('affiche l’échec du chargement sans données inventées', async () => {
    renderCharges(<ExpensesPage />, { [`GET ${listUrl}`]: problem(500, 'server_error') });
    expect(await screen.findByText('Impossible de charger les dépenses', {}, SLOW)).toBeTruthy();
    expect(screen.queryByRole('table', { name: 'Dépenses' })).toBeNull();
  });

  it('un rôle sans accès voit un refus net et aucun appel de données', async () => {
    const { calls } = renderCharges(<ExpensesPage />, {}, { role: 'viewer' });
    expect(await screen.findByText('Charges indisponibles pour ce compte')).toBeTruthy();
    expect(calls).toHaveLength(0);
  });

  it('un gestionnaire ne voit pas l’export', async () => {
    renderCharges(<ExpensesPage />, { [`GET ${listUrl}`]: { body: api.page([api.expense]) } }, { role: 'manager' });
    await listTable();
    expect(screen.queryByRole('button', { name: 'Exporter en CSV' })).toBeNull();
  });

  it('exporte le CSV de la période choisie', async () => {
    const { calls } = renderCharges(<ExpensesPage />, {
      [`GET ${listUrl}`]: { body: api.page([api.expense]) },
      [`GET ${chargesUrl('/expenses.csv')}`]: { csv: 'date;bien\n' },
    });
    await listTable();
    await userEvent.click(screen.getByRole('button', { name: 'Exporter en CSV' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Exporter en CSV' }));

    await waitFor(() => { expect(calls.some((call) => call.path === chargesUrl('/expenses.csv'))).toBe(true); }, SLOW);
    const csv = calls.find((call) => call.path === chargesUrl('/expenses.csv'));
    expect(csv?.search.get('from')).toMatch(/^\d{4}-01-01$/);
    await waitFor(() => { expect(vi.mocked(saveBlob)).toHaveBeenCalledTimes(1); }, SLOW);
    expect(vi.mocked(saveBlob).mock.calls[0]?.[1]).toMatch(/^depenses-\d{4}-01-01-\d{4}-\d{2}-\d{2}\.csv$/);
  });
});

describe('détail d’une dépense', () => {
  it('affiche la dépense, ses pièces et propose l’annulation', async () => {
    const { container } = renderCharges(<ExpenseDetailPage id={api.IDS.expense} />, { [`GET ${detailUrl(api.IDS.expense)}`]: { body: { data: api.expense } } });
    expect(await screen.findByRole('heading', { name: 'Société Propreté Plus' }, SLOW)).toBeTruthy();
    await screen.findByText('Résidence des Lilas', {}, SLOW);
    const text = norm(document.body.textContent);

    expect(text).toContain('Résidence des Lilas');
    expect(text).toContain('Pièce 1');
    expect(screen.getByRole('button', { name: 'Annuler la dépense' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Valider la dépense' })).toBeNull();
    await expectNoA11yViolations(container);
  });

  it('une dépense introuvable est dite introuvable', async () => {
    renderCharges(<ExpenseDetailPage id={api.IDS.expense} />, { [`GET ${detailUrl(api.IDS.expense)}`]: problem(404, 'expense_not_found') });
    expect(await screen.findByText('Dépense introuvable', {}, SLOW)).toBeTruthy();
  });

  it('annule avec un motif et refuse un motif vide avant tout appel', async () => {
    const cancelUrl = chargesUrl(`/expenses/${api.IDS.expense}/cancel`);
    const { callsTo } = renderCharges(<ExpenseDetailPage id={api.IDS.expense} />, {
      [`GET ${detailUrl(api.IDS.expense)}`]: { body: { data: api.expense } },
      [`POST ${cancelUrl}`]: { body: { data: { ...api.expense, status: 'cancelled', cancel_reason: 'Doublon' } } },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Annuler la dépense' }, SLOW));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Annuler la dépense' }));
    expect(await within(dialog).findByText(/Indiquez un motif/)).toBeTruthy();
    expect(callsTo('POST', cancelUrl)).toHaveLength(0);

    await userEvent.type(within(dialog).getByRole('textbox', { name: /Motif/ }), 'Doublon');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Annuler la dépense' }));

    await waitFor(() => { expect(callsTo('POST', cancelUrl)).toHaveLength(1); }, SLOW);
    expect(callsTo('POST', cancelUrl)[0]?.body).toEqual({ reason: 'Doublon' });
  });

  it('une dépense déjà retenue dans un exercice ne s’annule pas : message clair du 409', async () => {
    const cancelUrl = chargesUrl(`/expenses/${api.IDS.expense}/cancel`);
    renderCharges(<ExpenseDetailPage id={api.IDS.expense} />, {
      [`GET ${detailUrl(api.IDS.expense)}`]: { body: { data: api.expense } },
      [`POST ${cancelUrl}`]: problem(409, 'expense_in_use'),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Annuler la dépense' }, SLOW));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByRole('textbox', { name: /Motif/ }), 'Doublon');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Annuler la dépense' }));

    expect(await within(dialog).findByText(/incluse dans un exercice/, {}, SLOW)).toBeTruthy();
  });

  it('la validation exige une preuve de double authentification récente puis rejoue l’appel', async () => {
    const approveUrl = chargesUrl(`/expenses/${api.IDS.expenseTrust}/approve`);
    const { callsTo } = renderCharges(<ExpenseDetailPage id={api.IDS.expenseTrust} />, {
      [`GET ${detailUrl(api.IDS.expenseTrust)}`]: { body: { data: api.expensePending } },
      [`POST ${approveUrl}`]: twice(problem(403, 'reauthentication_required'), { body: { data: { ...api.expensePending, status: 'recorded', posted: true } } }),
      [PROOF_ROUTE]: { status: 204 },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Valider la dépense' }, SLOW));
    const confirm = await screen.findByRole('dialog', { name: 'Valider cette dépense ?' });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Valider la dépense' }));

    const proof = await screen.findByRole('dialog', { name: 'Confirmez votre identité' }, SLOW);
    await userEvent.type(within(proof).getByLabelText(/Code de double authentification/), '123456');
    await userEvent.click(within(proof).getByRole('button', { name: 'Confirmer' }));

    await waitFor(() => { expect(callsTo('POST', approveUrl)).toHaveLength(2); }, SLOW);
    expect(callsTo('POST', PROOF_ROUTE.slice(5))[0]?.body).toEqual({ code: '123456' });
  });

  it('sans double authentification activée, renvoie vers la sécurité du compte', async () => {
    const approveUrl = chargesUrl(`/expenses/${api.IDS.expenseTrust}/approve`);
    renderCharges(<ExpenseDetailPage id={api.IDS.expenseTrust} />, {
      [`GET ${detailUrl(api.IDS.expenseTrust)}`]: { body: { data: api.expensePending } },
      [`POST ${approveUrl}`]: problem(403, 'charges_two_factor_required'),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Valider la dépense' }, SLOW));
    const confirm = await screen.findByRole('dialog', { name: 'Valider cette dépense ?' });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Valider la dépense' }));

    expect(await within(confirm).findByRole('link', { name: 'Ouvrir Connexion et sécurité' }, SLOW)).toBeTruthy();
  });

  it('un gestionnaire ne peut pas valider une dépense sur les fonds du mandant', async () => {
    renderCharges(<ExpenseDetailPage id={api.IDS.expenseTrust} />, { [`GET ${detailUrl(api.IDS.expenseTrust)}`]: { body: { data: api.expensePending } } }, { role: 'manager' });
    await screen.findByText('En attente de validation', {}, SLOW);
    expect(screen.queryByRole('button', { name: 'Valider la dépense' })).toBeNull();
  });
});
