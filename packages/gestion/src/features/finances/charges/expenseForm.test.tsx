import { screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import * as api from './api/responses.fixtures';
import { ExpenseFormPage } from './ExpenseFormPage';
import { PROOF_ROUTE, chargesUrl, problem, renderCharges, twice } from './testing';
import type { MockRoute } from './api/testing';

const SLOW = { timeout: 4000 };
const createUrl = chargesUrl('/expenses');
type Money = ReturnType<typeof api.eur> | ReturnType<typeof api.xof>;
const listRoute = (currencyAmount: Money = api.eur(1)): MockRoute => ({ body: api.page([{ ...api.expense, total_gross: currencyAmount }]) });
const baseRoutes = (extra: Record<string, MockRoute> = {}, currency: Money = api.eur(1)): Record<string, MockRoute> => ({ [`GET ${createUrl}`]: listRoute(currency), ...extra });

async function pick(label: RegExp, option: string) {
  await userEvent.click(await screen.findByRole('combobox', { name: label }, SLOW));
  await userEvent.click(await screen.findByRole('option', { name: new RegExp(option) }, SLOW));
}

function type(label: RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

async function fill({ settlement, withFile = true, total = '1200', tax = '200', recoverable = '1000' }: { settlement?: string; withFile?: boolean; total?: string; tax?: string; recoverable?: string } = {}) {
  await pick(/^Bien/, 'Résidence des Lilas');
  await pick(/^Catégorie/, 'Entretien');
  type(/^Fournisseur/, 'Société Propreté Plus');
  type(/^Référence/, 'FAC-2026-014');
  type(/^Service rendu du/, '2026-01-01');
  type(/^au \(exclu\)/, '2026-04-01');
  type(/^Montant TTC/, total);
  type(/^dont TVA/, tax);
  type(/^Part récupérable/, recoverable);
  if (recoverable !== '0') await pick(/^Rubrique récupérable/, 'Entretien des parties communes');
  if (settlement !== undefined) await pick(/^Mode de règlement/, settlement);
  if (withFile) await userEvent.upload(screen.getByLabelText(/Pièce justificative/), new File(['%PDF'], 'facture.pdf', { type: 'application/pdf' }));
}

const submit = () => userEvent.click(screen.getByRole('button', { name: 'Enregistrer la dépense' }));

function postedForm(fetchImpl: { mock: { calls: Parameters<typeof fetch>[] } }): FormData[] {
  return fetchImpl.mock.calls.flatMap(([input, init]) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    return init?.method === 'POST' && url.includes('/charges/expenses') && init.body instanceof FormData ? [init.body] : [];
  });
}

describe('saisie d’une dépense', () => {
  it('envoie le formulaire en multipart avec la pièce, sans champ interdit, et ouvre la dépense créée', async () => {
    const { callsTo, fetchImpl, push } = renderCharges(<ExpenseFormPage />, baseRoutes({ [`POST ${createUrl}`]: { status: 201, body: { data: api.expense } } }), { kind: 'individual', role: 'owner' });
    await fill({ settlement: 'Banque' });
    await submit();

    await waitFor(() => { expect(push).toHaveBeenCalledWith(`/finances/depenses/${api.IDS.expense}`); }, SLOW);
    const [form] = postedForm(fetchImpl);
    expect(form?.get('property_id')).toBe(api.IDS.property);
    expect(form?.get('total_gross')).toBe('120000');
    expect(form?.get('tax_amount')).toBe('20000');
    expect(form?.get('recoverable_amount')).toBe('100000');
    expect(form?.get('recoverable_rubric')).toBe('cleaning');
    expect(form?.get('settlement')).toBe('bank');
    expect(form?.get('document')).toBeInstanceOf(File);
    expect(form?.has('unit_id')).toBe(false);
    expect(form?.has('paid_on')).toBe(false);
    for (const forbidden of ['currency', 'status', 'mandant_party_id', 'mandate_id', 'ledger_entry_id']) expect(form?.has(forbidden)).toBe(false);
    expect(callsTo('POST', createUrl)[0]?.headers.get('Idempotency-Key')).toMatch(/^ui-[A-Za-z0-9-]{8,}$/);
  });

  it('refuse un formulaire incomplet sans appeler le serveur et nomme les champs', async () => {
    const { callsTo } = renderCharges(<ExpenseFormPage />, baseRoutes(), { kind: 'individual', role: 'owner' });
    await screen.findByRole('button', { name: 'Enregistrer la dépense' }, SLOW);
    await submit();

    expect(await screen.findByText('Choisissez le bien.')).toBeTruthy();
    expect(screen.getByText('Choisissez la catégorie.')).toBeTruthy();
    expect(screen.getByText(/Montant TTC : montant valide/)).toBeTruthy();
    expect(callsTo('POST', createUrl)).toHaveLength(0);
  });

  it('exige la pièce pour une part récupérable', async () => {
    const { callsTo } = renderCharges(<ExpenseFormPage />, baseRoutes(), { kind: 'individual', role: 'owner' });
    await fill({ settlement: 'Banque', withFile: false });
    await submit();

    expect(await screen.findByText(/La pièce justificative est obligatoire/)).toBeTruthy();
    expect(callsTo('POST', createUrl)).toHaveLength(0);
  });

  it('refuse une TVA supérieure au TTC et une part récupérable supérieure au TTC', async () => {
    renderCharges(<ExpenseFormPage />, baseRoutes(), { kind: 'individual', role: 'owner' });
    await fill({ settlement: 'Banque', total: '100', tax: '150', recoverable: '200' });
    await submit();

    expect(await screen.findByText('La TVA ne peut pas dépasser le montant TTC.')).toBeTruthy();
    expect(screen.getByText('La part récupérable ne peut pas dépasser le montant TTC.')).toBeTruthy();
  });

  it('propose les règlements autorisés selon le rôle et le type d’organisation', async () => {
    const options = async () => {
      await userEvent.click(await screen.findByRole('combobox', { name: /^Mode de règlement/ }, SLOW));
      return (await screen.findAllByRole('option')).map((option) => option.textContent);
    };
    const individual = renderCharges(<ExpenseFormPage />, baseRoutes(), { kind: 'individual', role: 'owner' });
    expect((await options()).join('|')).toMatch(/Banque.*Espèces.*Sans règlement/);
    individual.unmount();

    const manager = renderCharges(<ExpenseFormPage />, baseRoutes(), { kind: 'agency', role: 'manager' });
    const managerOptions = (await options()).join('|');
    expect(managerOptions).toContain('Payée par le mandant');
    expect(managerOptions).not.toContain('Fonds du mandant');
    expect(managerOptions).not.toContain('Avance de l’agence');
    manager.unmount();
  });

  it('affiche la devise de l’organisation : pas de décimales en francs CFA', async () => {
    renderCharges(<ExpenseFormPage />, baseRoutes({}, api.xof(5000)), { kind: 'individual', role: 'owner' });
    const field = await screen.findByLabelText(/Montant TTC \(XOF\)/, {}, SLOW);
    expect(field.getAttribute('placeholder')).toBe('ex. 120000');
    await fill({ settlement: 'Banque', total: '1200,50' });
    await submit();
    expect(await screen.findByText(/nombre entier de francs/)).toBeTruthy();
  });

  it('traduit un 422 du serveur et conserve la saisie', async () => {
    renderCharges(<ExpenseFormPage />, baseRoutes({ [`POST ${createUrl}`]: problem(422, 'expense_split_required') }), { kind: 'individual', role: 'owner' });
    await fill({ settlement: 'Banque' });
    await submit();

    expect(await screen.findByText(/plusieurs mandants/, {}, SLOW)).toBeTruthy();
    expect(screen.getByDisplayValue('FAC-2026-014')).toBeTruthy();
  });

  it('un 429 explique l’attente et qu’aucune dépense n’a été enregistrée', async () => {
    const limited = { ...problem(429, 'too_many_requests'), headers: { 'Retry-After': '30' } };
    renderCharges(<ExpenseFormPage />, baseRoutes({ [`POST ${createUrl}`]: limited }), { kind: 'individual', role: 'owner' });
    await fill({ settlement: 'Banque' });
    await submit();

    expect(await screen.findByText(/dans 30 secondes/, {}, SLOW)).toBeTruthy();
  });

  it('sur fonds du mandant, redemande la double authentification puis rejoue avec la même clé d’idempotence', async () => {
    const { callsTo, fetchImpl, push } = renderCharges(
      <ExpenseFormPage />,
      baseRoutes({ [`POST ${createUrl}`]: twice(problem(403, 'reauthentication_required'), { status: 201, body: { data: api.expensePending } }), [PROOF_ROUTE]: { status: 204 } }),
      { kind: 'agency', role: 'accountant' },
    );
    await fill({ settlement: 'Fonds du mandant' });
    await submit();

    const proof = await screen.findByRole('dialog', { name: 'Confirmez votre identité' }, SLOW);
    await userEvent.type(within(proof).getByLabelText(/Code de double authentification/), '123456');
    await userEvent.click(within(proof).getByRole('button', { name: 'Confirmer' }));

    await waitFor(() => { expect(push).toHaveBeenCalledWith(`/finances/depenses/${api.IDS.expenseTrust}`); }, SLOW);
    const posts = callsTo('POST', createUrl);
    expect(posts).toHaveLength(2);
    expect(posts[0]?.headers.get('Idempotency-Key')).toBe(posts[1]?.headers.get('Idempotency-Key'));
    expect(postedForm(fetchImpl)).toHaveLength(2);
  });

  it('sans double authentification activée, le refus renvoie vers la sécurité du compte', async () => {
    renderCharges(<ExpenseFormPage />, baseRoutes({ [`POST ${createUrl}`]: problem(403, 'charges_two_factor_required') }), { kind: 'agency', role: 'accountant' });
    await fill({ settlement: 'Fonds du mandant' });
    await submit();

    expect(await screen.findByRole('link', { name: 'Ouvrir Connexion et sécurité' }, SLOW)).toBeTruthy();
  });

  it('un rôle sans droit sur les charges ne voit pas le formulaire', async () => {
    const { calls } = renderCharges(<ExpenseFormPage />, baseRoutes(), { role: 'viewer' });
    expect(await screen.findByText('Charges indisponibles pour ce compte')).toBeTruthy();
    expect(calls).toHaveLength(0);
  });
});
