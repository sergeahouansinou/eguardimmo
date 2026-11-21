import { describe, expect, it } from 'vitest';
import { BankingApiError } from './bankingErrors';
import { createApiBankingSource } from './bankingSource';
import * as fx from './responses.fixtures';
import { mockBankingApi, orgPath } from './testing';
import type { MockRoute } from './testing';
import type { AccountInput } from '../model';

const url = (path: string): string => orgPath(fx.IDS.org, `/banking${path}`);

function setup(routes: Record<string, MockRoute>, role: string | null = 'owner') {
  const mock = mockBankingApi(routes);
  const source = createApiBankingSource({ client: mock.client, organizationId: fx.IDS.org, role }, { fetchImpl: mock.fetchImpl });
  return { source, ...mock };
}

const input: AccountInput = {
  ledgerRole: 'bank',
  label: 'Compte courant agence',
  bankName: 'Banque Populaire',
  holderName: 'Agence Dupont Immobilier',
  identifierKind: 'iban',
  identifier: 'FR76 3000 6000 0112 3456 7890 189',
  country: 'fr',
  reconciliationFrom: '2026-01-01',
  openingBankBalance: 1250050,
  csvProfile: null,
};

const failure = async (action: Promise<unknown>): Promise<BankingApiError> => {
  const error = await action.then(() => null, (reason: unknown) => reason);
  if (!(error instanceof BankingApiError)) throw new Error('BankingApiError attendue');
  return error;
};

const problem = (status: number, code: string, extra: Record<string, unknown> = {}, headers: Record<string, string> = {}) => ({ status, headers, body: { type: 'about:blank', title: 'x', status, code, detail: 'detail serveur', ...extra } });

describe('permissions par rôle', () => {
  it.each([
    ['owner', true, true],
    ['admin', true, true],
    ['accountant', true, false],
    ['manager', false, false],
    [null, false, false],
  ])('%s : accès %s, gestion des comptes %s', (role, available, manage) => {
    expect(setup({}, role).source.permissions).toEqual({ available, manageAccounts: manage });
  });
});

describe('lectures', () => {
  it('lit les comptes sans jamais exposer l’identifiant complet', async () => {
    const { source } = setup({ [`GET ${url('/accounts')}`]: { body: { data: [fx.account] } } });
    const accounts = await source.accounts();
    expect(accounts[0]?.last4).toBe('0189');
    expect(JSON.stringify(accounts)).not.toContain('FR76');
    expect(accounts[0]?.openingBankBalance).toEqual({ amount: 1250050, currency: 'EUR' });
  });

  it('lit une page de lignes avec proposition, curseur et explication codée', async () => {
    const { source, calls } = setup({ [`GET ${url('/lines')}`]: { body: { data: [fx.lineLoyer], links: {}, meta: { next_cursor: 'abc' } } } });
    const page = await source.lines({ accountId: fx.IDS.account, state: 'unmatched', cursor: null, direction: 'credit' });
    expect(page.nextCursor).toBe('abc');
    expect(page.items[0]?.suggestion?.codes).toEqual(['notice_number_in_remittance', 'amount_equals_outstanding']);
    expect(page.items[0]?.signedAmount.amount).toBe(85000);
    expect(calls[0]?.search.get('account_id')).toBe(fx.IDS.account);
    expect(calls[0]?.search.get('state')).toBe('unmatched');
    expect(calls[0]?.search.get('direction')).toBe('credit');
  });

  it('lit un relevé avec ses trous', async () => {
    const { source } = setup({ [`GET ${url(`/statements/${fx.IDS.statement}`)}`]: { body: { data: fx.statement, meta: { gaps: [fx.gap] } } } });
    const detail = await source.statement(fx.IDS.statement);
    expect(detail.gaps).toEqual([{ previousStatementId: fx.IDS.statementPrev, statementId: fx.IDS.statement, expectedOpening: 1250050, actualOpening: 1200000 }]);
  });

  it('refuse une réponse qui ne reproduit pas la ressource', async () => {
    const { last4: removed, ...broken } = fx.account;
    expect(removed).toBe('0189');
    const { source } = setup({ [`GET ${url('/accounts')}`]: { body: { data: [broken] } } });
    expect((await failure(source.accounts())).kind).toBe('unexpected_response');
  });
});

describe('écritures', () => {
  it('crée un compte : identifiant compacté, pays en majuscules, clé d’idempotence', async () => {
    const { source, callsTo } = setup({ [`POST ${url('/accounts')}`]: { status: 201, body: { data: fx.account } } });
    await source.createAccount(input, 'ui-0123456789');
    const call = callsTo('POST', url('/accounts'))[0];
    expect(call?.headers.get('Idempotency-Key')).toBe('ui-0123456789');
    expect(call?.body).toMatchObject({ ledger_role: 'bank', identifier: 'FR7630006000011234567890189', country: 'FR', opening_bank_balance: 1250050 });
  });

  it('refuse localement une clé d’idempotence invalide sans appeler le réseau', async () => {
    const { source, calls } = setup({});
    expect((await failure(source.createAccount(input, 'court'))).kind).toBe('invalid');
    expect(calls).toHaveLength(0);
  });

  it('importe un relevé en multipart avec clé d’idempotence et lignes refusées', async () => {
    const { source, callsTo } = setup({ [`POST ${url(`/accounts/${fx.IDS.account}/statements`)}`]: { status: 201, body: { data: { ...fx.statement, lines_rejected: 1 }, meta: { rejected: [{ line: 4, code: 'date_invalid' }] } } } });
    const file = new File(['a;b'], 'mars.csv', { type: 'text/csv' });
    const result = await source.importStatement(fx.IDS.account, file, 'csv', null, 'ui-import-0001');
    expect(result.rejected).toEqual([{ line: 4, code: 'date_invalid' }]);
    expect(result.statement.linesRejected).toBe(1);
    const call = callsTo('POST', url(`/accounts/${fx.IDS.account}/statements`))[0];
    expect(call?.headers.get('Idempotency-Key')).toBe('ui-import-0001');
    expect(call?.form).toMatchObject({ format: 'csv', file: 'file:mars.csv:3' });
  });

  it('envoie le profil CSV fourni, jamais celui d’un autre format', async () => {
    const { source, callsTo } = setup({ [`POST ${url(`/accounts/${fx.IDS.account}/statements/preview`)}`]: { body: { data: fx.preview } } });
    const profile = { delimiter: ';' as const, encoding: 'UTF-8' as const, hasHeader: true, dateFormat: 'd/m/Y' as const, decimalSeparator: ',' as const, thousandsSeparator: null, columns: { booking_date: 1, label: 2, amount: 3 } };
    await source.previewStatement(fx.IDS.account, new File(['x'], 'a.csv'), 'csv', profile);
    await source.previewStatement(fx.IDS.account, new File(['x'], 'a.xml'), 'camt053', profile);
    const [csv, xml] = callsTo('POST', url(`/accounts/${fx.IDS.account}/statements/preview`));
    expect(csv?.form).toMatchObject({ 'csv_profile[delimiter]': ';', 'csv_profile[has_header]': '1', 'csv_profile[columns][amount]': '3' });
    expect(Object.keys(xml?.form ?? {}).some((key) => key.startsWith('csv_profile'))).toBe(false);
  });

  it('crée l’encaissement depuis une ligne avec la version de la ligne', async () => {
    const { source, callsTo } = setup({ [`POST ${url(`/lines/${fx.IDS.lineA}/settle`)}`]: { status: 201, body: { data: fx.match } } });
    await source.settleLine(fx.IDS.lineA, { action: 'settle_lease', allocations: [{ leaseId: fx.IDS.lease, amount: 50000 }, { leaseId: fx.IDS.leaseB, amount: 35000 }] }, 1, 'ui-settle-0001');
    expect(callsTo('POST', url(`/lines/${fx.IDS.lineA}/settle`))[0]?.body).toEqual({ action: 'settle_lease', allocations: [{ lease_id: fx.IDS.lease, amount: 50000 }, { lease_id: fx.IDS.leaseB, amount: 35000 }], lock_version: 1 });
  });

  it('défait un pointage avec son motif', async () => {
    const { source, callsTo } = setup({ [`POST ${url(`/matches/${fx.IDS.match}/undo`)}`]: { body: { data: { ...fx.match, undone_at: '2026-04-06T10:00:00+00:00', undo_reason: 'Erreur' } } } });
    await source.undoMatch(fx.IDS.match, 'Erreur de locataire');
    expect(callsTo('POST', url(`/matches/${fx.IDS.match}/undo`))[0]?.body).toEqual({ reason: 'Erreur de locataire' });
  });

  it('accepte des propositions et décrit les écartées', async () => {
    const { source } = setup({ [`POST ${url('/suggestions/accept')}`]: { body: { data: { accepted: [{ suggestion_id: fx.IDS.suggestionA, match_id: fx.IDS.match }], skipped: [{ suggestion_id: fx.IDS.suggestionB, reason: 'not_acceptable' }], replayed: false } } } });
    const result = await source.acceptSuggestions([fx.IDS.suggestionA, fx.IDS.suggestionB], 'ui-accept-0001');
    expect(result.accepted).toEqual([{ suggestionId: fx.IDS.suggestionA, matchId: fx.IDS.match }]);
    expect(result.skipped).toEqual([{ suggestionId: fx.IDS.suggestionB, reason: 'not_acceptable' }]);
  });

  it('construit un état avec solde saisi et pièce en multipart', async () => {
    const { source, callsTo } = setup({ [`POST ${url('/reconciliations')}`]: { status: 201, body: { data: fx.reconciliation } } });
    await source.buildReconciliation({ accountId: fx.IDS.account, month: '2026-03', bankBalance: 1480050, proof: new File(['pdf'], 'releve.pdf', { type: 'application/pdf' }) }, 'ui-build-0001');
    expect(callsTo('POST', url('/reconciliations'))[0]?.form).toMatchObject({ bank_account_id: fx.IDS.account, month: '2026-03', bank_balance: '1480050', proof: 'file:releve.pdf:3' });
  });
});

describe('téléchargements', () => {
  it('télécharge le relevé brut', async () => {
    const { source } = setup({ [`GET ${url(`/statements/${fx.IDS.statement}/file`)}`]: { file: { type: 'text/csv', content: 'a;b' } } });
    expect(await (await source.downloadStatement(fx.IDS.statement)).text()).toBe('a;b');
  });

  it('refuse un type de fichier inattendu', async () => {
    const { source } = setup({ [`GET ${url(`/reconciliations/${fx.IDS.reconciliation}/proof`)}`]: { file: { type: 'text/html', content: '<script>' } } });
    expect((await failure(source.downloadProof(fx.IDS.reconciliation))).kind).toBe('unexpected_response');
  });
});

describe('erreurs traduites', () => {
  const run = (reply: ReturnType<typeof problem>) => setup({ [`GET ${url('/accounts')}`]: reply }).source.accounts();

  it('403 rôle', async () => {
    const error = await failure(run(problem(403, 'role_forbidden')));
    expect(error.kind).toBe('forbidden');
    expect(error.message).toContain('titulaire');
  });

  it('403 double authentification absente', async () => { expect((await failure(run(problem(403, 'two_factor_required')))).kind).toBe('two_factor_required'); });
  it('403 preuve de moins de 10 minutes', async () => { expect((await failure(run(problem(403, 'reauthentication_required')))).kind).toBe('reauthentication_required'); });
  it('404', async () => { expect((await failure(run(problem(404, 'bank_account_not_found')))).message).toContain('compte bancaire'); });
  it('409 ligne périmée', async () => { expect((await failure(run(problem(409, 'bank_line_stale')))).kind).toBe('stale'); });
  it('409 requête concurrente', async () => { expect((await failure(run(problem(409, 'banking_request_conflict')))).kind).toBe('stale'); });
  it('409 pointage verrouillé', async () => { expect((await failure(run(problem(409, 'bank_match_locked')))).kind).toBe('conflict'); });
  it('422 curseur invalide', async () => { expect((await failure(run(problem(422, 'bank_cursor_invalid')))).message).toContain('page demandée'); });
  it('422 pièce obligatoire', async () => { expect((await failure(run(problem(422, 'bank_reconciliation_proof_required')))).message).toContain('pièce'); });
  it('429 avec délai', async () => {
    const error = await failure(run(problem(429, 'throttled', {}, { 'Retry-After': '30' })));
    expect(error.kind).toBe('rate_limited');
    expect(error.message).toContain('dans 30 secondes');
  });
  it('503 XSD indisponible', async () => {
    const error = await failure(run(problem(503, 'banking_xsd_unavailable')));
    expect(error.kind).toBe('unavailable');
    expect(error.message).toContain('camt.053');
  });
  it('n’affiche jamais la requête ni un libellé bancaire dans le message', async () => {
    const error = await failure(run(problem(409, 'bank_match_unbalanced', { detail: 'VIR LOYER MARTIN FR7630006000011234567890189' })));
    expect(error.message).not.toContain('MARTIN');
    expect(error.message).not.toContain('FR76');
  });
});

describe('devise', () => {
  it('lit la devise depuis les comptes suivis', async () => {
    const { source } = setup({ [`GET ${url('/accounts')}`]: { body: { data: [fx.account] } } });
    expect(await source.currency()).toBe('EUR');
  });

  it('retombe sur la comptabilité, puis null', async () => {
    const { source } = setup({
      [`GET ${url('/accounts')}`]: { body: { data: [] } },
      [`GET ${orgPath(fx.IDS.org, '/accounting/accounts')}`]: { body: fx.accountingBalances },
    });
    expect(await source.currency()).toBe('EUR');
    const empty = setup({ [`GET ${url('/accounts')}`]: { body: { data: [] } }, [`GET ${orgPath(fx.IDS.org, '/accounting/accounts')}`]: { body: { data: [] } } });
    expect(await empty.source.currency()).toBeNull();
  });
});
