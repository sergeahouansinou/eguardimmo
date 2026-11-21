import { describe, expect, it } from 'vitest';
import { ChargesApiError } from './chargesErrors';
import { createApiChargesSource } from './chargesSource';
import * as api from './responses.fixtures';
import { mockChargesApi, orgPath } from './testing';
import type { MockRoute } from './testing';
import type { ExpenseInput } from '../model';

const url = (path: string) => orgPath(api.IDS.org, `/charges${path}`);

function setup(routes: Record<string, MockRoute>, role: string | null = 'accountant', kind: 'agency' | 'individual' | null = 'agency') {
  const mock = mockChargesApi(routes);
  const source = createApiChargesSource({ client: mock.client, organizationId: api.IDS.org, role, kind }, { fetchImpl: mock.fetchImpl });
  return { source, ...mock };
}

const input: ExpenseInput = {
  propertyId: api.IDS.property,
  unitId: '',
  kind: 'payment',
  categoryTermId: api.IDS.category,
  payeeLabel: 'Société Propreté Plus',
  reference: 'FAC-2026-014',
  documentOn: '2026-03-12',
  serviceFrom: '2026-01-01',
  serviceTo: '2026-04-01',
  totalGross: 120000,
  taxAmount: 20000,
  recoverableAmount: 100000,
  recoverableRubric: 'cleaning',
  settlement: 'bank',
  paidOn: '2026-03-15',
  document: new File(['pdf'], 'facture.pdf', { type: 'application/pdf' }),
};

describe('source API des charges', () => {
  it('lit la liste des dépenses avec filtres et curseur, montants en unités mineures', async () => {
    const { source, calls } = setup({ [`GET ${url('/expenses')}`]: { body: api.page([api.expense], 'abc') } });

    const page = await source.expenses({ cursor: null, propertyId: api.IDS.property, status: 'recorded', settlement: 'bank', from: '2026-01-01', to: '2026-12-31' });

    expect(page.nextCursor).toBe('abc');
    expect(page.items[0]?.totalGross).toEqual({ amount: 120000, currency: 'EUR' });
    expect(calls[0]?.search.get('property_id')).toBe(api.IDS.property);
    expect(calls[0]?.search.get('settlement')).toBe('bank');
    expect(calls[0]?.search.get('to')).toBe('2026-12-31');
  });

  it('enregistre une dépense avec Idempotency-Key', async () => {
    const { source, calls } = setup({ [`POST ${url('/expenses')}`]: { status: 201, body: { data: api.expense } } });

    const created = await source.recordExpense(input, 'ui-0123456789');

    expect(created.id).toBe(api.IDS.expense);
    expect(calls[0]?.method).toBe('POST');
    expect(calls[0]?.headers.get('Idempotency-Key')).toBe('ui-0123456789');
  });

  it('refuse avant tout appel une clé d’idempotence invalide', async () => {
    const { source, calls } = setup({});

    await expect(source.recordExpense(input, 'court')).rejects.toMatchObject({ kind: 'invalid' });
    expect(calls).toHaveLength(0);
  });

  it('refuse un montant total nul sans appeler le serveur', async () => {
    const { source, calls } = setup({});

    await expect(source.recordExpense({ ...input, totalGross: 0 }, 'ui-0123456789')).rejects.toBeInstanceOf(ChargesApiError);
    expect(calls).toHaveLength(0);
  });

  it('lit un exercice calculé avec ses baux exclus et ses décomptes', async () => {
    const { source } = setup({ [`POST ${url(`/exercises/${api.IDS.exercise}/compute`)}`]: { body: { data: api.exerciseComputed } } });

    const detail = await source.computeExercise(api.IDS.exercise);

    expect(detail.excludedLeases).toEqual([{ leaseId: api.IDS.leaseB, reason: 'flat_rate' }]);
    expect(detail.statements[0]?.balance.amount).toBe(-8000);
    expect(detail.items[0]?.ownerShare.amount).toBe(36000);
  });

  it('émet avec acknowledge_prescription seulement quand il est demandé', async () => {
    const path = url(`/exercises/${api.IDS.exercise}/issue`);
    const { source, calls } = setup({ [`POST ${path}`]: { body: { data: api.exerciseIssued } } });

    await source.issueExercise(api.IDS.exercise, 'ui-0123456789', false);
    await source.issueExercise(api.IDS.exercise, 'ui-0123456789', true);

    expect(calls[0]?.body).toEqual({});
    expect(calls[1]?.body).toEqual({ acknowledge_prescription: true });
    expect(calls[0]?.headers.get('Idempotency-Key')).toBe('ui-0123456789');
  });

  it('publie ou retire une pièce au locataire par PATCH tenant_visible', async () => {
    const path = url(`/statements/${api.IDS.statement}/files/${api.IDS.stmtFile}`);
    const shared = { ...api.statement, files: [{ ...api.statement.files[0], tenant_visible: true, visible_until: '2027-05-16' }] };
    const { source, calls } = setup({ [`PATCH ${path}`]: { body: { data: shared } } });

    const result = await source.shareStatementFile(api.IDS.statement, api.IDS.stmtFile, true);

    expect(calls[0]?.body).toEqual({ tenant_visible: true });
    expect(result.files[0]).toMatchObject({ tenantVisible: true, visibleUntil: '2027-05-16' });
  });

  it('télécharge le PDF du décompte et l’export CSV des dépenses', async () => {
    const { source, calls } = setup({
      [`GET ${url(`/statements/${api.IDS.statement}/pdf`)}`]: { file: { type: 'application/pdf', content: '%PDF' } },
      [`GET ${url('/expenses.csv')}`]: { csv: 'date;bien\n' },
    });

    expect((await source.downloadStatementPdf(api.IDS.statement)).type).toContain('application/pdf');
    expect((await source.exportExpenses({ from: '2026-01-01', to: '2027-01-01', propertyId: null })).type).toContain('text/csv');
    expect(calls[1]?.search.get('from')).toBe('2026-01-01');
  });

  it('rejette un contenu inattendu à la place du PDF', async () => {
    const { source } = setup({ [`GET ${url(`/statements/${api.IDS.statement}/pdf`)}`]: { file: { type: 'text/html', content: '<p>' } } });

    await expect(source.downloadStatementPdf(api.IDS.statement)).rejects.toMatchObject({ kind: 'unexpected_response' });
  });

  it('dérive la devise de la dernière dépense, EUR sinon', async () => {
    const xofExpense = { ...api.expense, total_gross: api.xof(5000) };

    expect(await setup({ [`GET ${url('/expenses')}`]: { body: api.page([xofExpense]) } }).source.currency()).toBe('XOF');
    expect(await setup({ [`GET ${url('/expenses')}`]: { body: api.page([]) } }).source.currency()).toBe('EUR');
  });

  it('écarte les catégories masquées des choix', async () => {
    const hidden = { ...api.terms.data[0], id: '01934f6e-0000-7000-8000-0000000001b1', hidden: true };
    const { source } = setup({ [`GET ${orgPath(api.IDS.org, '/catalog/vocabularies/expense_category/terms')}`]: { body: { data: [...api.terms.data, hidden] } } });

    const terms = await source.terms('expense_category');

    expect(terms.map((term) => term.label)).toEqual(['Entretien']);
    expect(terms[0]?.recoverableByDefault).toBe(true);
  });
});

describe('erreurs de l’API des charges traduites', () => {
  const problem = (status: number, code: string, extra: Record<string, unknown> = {}, headers: Record<string, string> = {}): MockRoute => ({
    status,
    body: { type: 'about:blank', title: 'x', status, code, detail: 'detail serveur', ...extra },
    headers,
  });
  const read = async (route: MockRoute) => {
    const { source } = setup({ [`GET ${url(`/expenses/${api.IDS.expense}`)}`]: route });
    return source.expense(api.IDS.expense).then(
      () => null,
      (error: unknown) => error,
    );
  };

  it.each([
    [403, 'charges_role_forbidden', 'forbidden', 'Votre rôle ne permet pas'],
    [403, 'reauthentication_required', 'reauthentication_required', 'moins de 10 minutes'],
    [403, 'charges_two_factor_required', 'two_factor_required', 'double authentification'],
    [404, 'expense_not_found', 'not_found', 'n’existe pas dans votre organisation'],
    [409, 'charge_source_exhausted', 'conflict', 'déjà retenue'],
    [409, 'charges_stale_version', 'stale', 'rechargez'],
    [409, 'expense_in_use', 'conflict', 'incluse dans un exercice'],
    [422, 'expense_split_required', 'invalid', 'plusieurs mandants'],
    [422, 'expense_invalid', 'invalid', 'detail serveur'],
    [503, 'charges_pdf_unavailable', 'unavailable', 'PDF est momentanément indisponible'],
  ] as const)('%s %s devient %s', async (status, code, kind, text) => {
    const error = await read(problem(status, code));

    expect(error).toBeInstanceOf(ChargesApiError);
    expect(error).toMatchObject({ kind, code });
    expect((error as ChargesApiError).message).toContain(text);
  });

  it('indique l’attente d’un 429 et la première erreur de champ d’un 422', async () => {
    const limited = await read(problem(429, 'too_many_requests', {}, { 'Retry-After': '30' }));
    const invalid = await read(problem(422, 'validation_failed', { errors: { total_gross: ['Le montant doit être au moins 1.'] } }));

    expect((limited as ChargesApiError).message).toContain('dans 30 secondes');
    expect((limited as ChargesApiError).message).toContain('Aucune modification');
    expect((invalid as ChargesApiError).message).toBe('Le montant doit être au moins 1.');
  });

  it('refuse une réponse qui ne respecte pas le contrat', async () => {
    const error = await read({ body: { data: { ...api.expense, total_gross: { amount: 12.5, currency: 'EUR' } } } });

    expect(error).toMatchObject({ kind: 'unexpected_response' });
  });
});
