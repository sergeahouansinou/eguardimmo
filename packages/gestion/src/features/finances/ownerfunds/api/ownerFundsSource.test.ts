import { ApiUnreachableError, createApiClient } from '@eguardimmo/api';
import { describe, expect, it, vi } from 'vitest';
import { OwnerFundsApiError } from './ownerFundsErrors';
import { createApiOwnerFundsSource } from './ownerFundsSource';
import * as api from './responses.fixtures';
import { mockOwnerFundsApi, orgPath } from './testing';
import type { MockRoute } from './testing';

const funds = (path: string) => orgPath(api.IDS.org, `/owner-funds${path}`);
const plain = (path: string) => orgPath(api.IDS.org, path);
const NOW = new Date('2026-11-16T10:00:00Z');
const KEY = 'ui-key-00000001';

function build(routes: Record<string, MockRoute>, role: 'owner' | 'admin' | 'manager' | 'accountant' | null = 'accountant', kind: 'agency' | 'individual' | null = 'agency') {
  const mock = mockOwnerFundsApi(routes);
  const source = createApiOwnerFundsSource({ client: mock.client, organizationId: api.IDS.org, role, kind }, { now: () => NOW, fetchImpl: mock.fetchImpl });
  return { source, ...mock };
}

describe('droits', () => {
  it('le gestionnaire prépare sans faire sortir d’argent ni exporter', () => {
    expect(build({}, 'manager').source.permissions).toEqual({ available: true, prepare: true, sensitive: false, export: false });
  });

  it.each(['owner', 'admin', 'accountant'] as const)('%s dispose des actions sensibles et de l’export', (role) => {
    expect(build({}, role).source.permissions).toEqual({ available: true, prepare: true, sensitive: true, export: true });
  });

  it('une organisation autonome ou sans rôle n’a rien', () => {
    const none = { available: false, prepare: false, sensitive: false, export: false };
    expect(build({}, 'owner', 'individual').source.permissions).toEqual(none);
    expect(build({}, null).source.permissions).toEqual(none);
    expect(build({}, 'owner', null).source.permissions).toEqual(none);
  });
});

describe('lectures', () => {
  it('charge l’aperçu avec la limite et renvoie les montants du serveur', async () => {
    const { source, callsTo } = build({ [`GET ${funds('/payouts/preview')}`]: { body: api.previewTruncated } });
    const preview = await source.preview(1);
    expect(preview.truncated).toBe(true);
    expect(preview.limit).toBe(1);
    expect(preview.accounts[0]).toMatchObject({ mandantId: api.IDS.mandantA, netPayable: { amount: 106800, currency: 'EUR' }, bankLast4: '4321', exclusionReason: null });
    expect(callsTo('GET', funds('/payouts/preview'))[0]?.search.get('limit')).toBe('1');
  });

  it('n’envoie pas de limite quand elle n’est pas demandée', async () => {
    const { source, callsTo } = build({ [`GET ${funds('/payouts/preview')}`]: { body: api.preview } });
    await source.preview();
    expect(callsTo('GET', funds('/payouts/preview'))[0]?.search.has('limit')).toBe(false);
  });

  it('charge le compte d’un mandant', async () => {
    const { source } = build({ [`GET ${funds(`/mandants/${api.IDS.mandantA}/account`)}`]: { body: api.account } });
    const account = await source.mandantAccount(api.IDS.mandantA);
    expect(account.payable.amount).toBe(120000);
    expect(account.feesDue.amount).toBe(9600);
  });

  it('liste les lots avec le curseur et expose le suivant', async () => {
    const { source, callsTo } = build({ [`GET ${funds('/batches')}`]: { body: api.batchesPageNext } });
    const page = await source.batches('abc');
    expect(page.nextCursor).toBe('curseur-2');
    expect(page.items[0]?.items).toBeNull();
    expect(callsTo('GET', funds('/batches'))[0]?.search.get('cursor')).toBe('abc');
    expect(callsTo('GET', funds('/batches'))[0]?.search.get('per_page')).toBe('25');
  });

  it('charge un lot avec ses éléments', async () => {
    const { source } = build({ [`GET ${funds(`/batches/${api.IDS.batchDraft}`)}`]: { body: api.batchDraft } });
    const batch = await source.batch(api.IDS.batchDraft);
    expect(batch.lockVersion).toBe(3);
    expect(batch.items).toHaveLength(2);
    expect(batch.items?.[1]).toMatchObject({ status: 'excluded', exclusionReason: 'no_payout_account', bankLast4: null });
  });

  it('filtre les retenues et les honoraires', async () => {
    const { source, callsTo } = build({ [`GET ${funds('/holds')}`]: { body: api.holdsPage }, [`GET ${funds('/fees')}`]: { body: api.feesPage } });
    const holds = await source.holds({ mandantId: api.IDS.mandantA, activeOnly: true });
    expect(holds.items[0]).toMatchObject({ kind: 'reserve', amount: { amount: 20000, currency: 'EUR' }, reason: 'works_reserve' });
    expect(holds.items[1]?.amount).toBeNull();
    expect(callsTo('GET', funds('/holds'))[0]?.search.get('mandant')).toBe(api.IDS.mandantA);
    expect(callsTo('GET', funds('/holds'))[0]?.search.get('active')).toBe('1');
    const fees = await source.fees({ month: '2026-10' });
    expect(fees.items[0]).toMatchObject({ month: '2026-10', rateBp: 800, feeTotal: { amount: 11520, currency: 'EUR' }, invoiceId: api.IDS.invoice });
    expect(callsTo('GET', funds('/fees'))[0]?.search.get('month')).toBe('2026-10');
  });

  it('charge la couverture, les apports et les mois clos triés du plus récent au plus ancien', async () => {
    const { source } = build({
      [`GET ${funds('/trust/coverage')}`]: { body: api.coverage },
      [`GET ${funds('/trust/deposits')}`]: { body: api.depositsPage },
      [`GET ${plain('/accounting/periods')}`]: { body: api.periods },
    });
    expect((await source.coverage()).surplus.amount).toBe(140000);
    expect((await source.deposits(null)).items).toHaveLength(2);
    expect((await source.periods()).map((period) => period.month)).toEqual(['2026-10', '2026-09']);
  });

  it('lit le nom d’un mandant et masque une partie anonymisée', async () => {
    const { source } = build({
      [`GET ${plain(`/parties/${api.IDS.mandantA}`)}`]: { body: api.partyA },
      [`GET ${plain(`/parties/${api.IDS.mandantB}`)}`]: { body: { data: { ...api.partyB.data, is_anonymized: true } } },
    });
    expect(await source.partyName(api.IDS.mandantA)).toBe('Awa Diallo');
    expect(await source.partyName(api.IDS.mandantB)).toBeNull();
  });

  it('refuse une réponse dont la forme change et une devise inconnue', async () => {
    const { source } = build({
      [`GET ${funds('/trust/coverage')}`]: { body: { data: { ...api.coverage.data, covered: 'oui' } } },
      [`GET ${funds(`/mandants/${api.IDS.mandantA}/account`)}`]: { body: { data: { ...api.account.data, payable: { amount: 1, currency: 'USD' } } } },
    });
    await expect(source.coverage()).rejects.toMatchObject({ kind: 'unexpected_response' });
    await expect(source.mandantAccount(api.IDS.mandantA)).rejects.toMatchObject({ kind: 'unexpected_response' });
  });

  it('refuse un montant décimal : le serveur parle en unités mineures entières', async () => {
    const { source } = build({ [`GET ${funds('/trust/coverage')}`]: { body: { data: { ...api.coverage.data, surplus: { amount: 10.5, currency: 'EUR' } } } } });
    await expect(source.coverage()).rejects.toBeInstanceOf(OwnerFundsApiError);
  });

  it('sans organisation, ne lance aucun appel', async () => {
    const mock = mockOwnerFundsApi({});
    const source = createApiOwnerFundsSource({ client: mock.client, organizationId: null, role: 'owner', kind: 'agency' }, { fetchImpl: mock.fetchImpl });
    await expect(source.coverage()).rejects.toMatchObject({ kind: 'no_organization' });
    expect(mock.calls).toHaveLength(0);
  });

  it('traduit une panne réseau en erreur du client', async () => {
    const client = createApiClient({ baseUrl: 'https://api.test', fetchImpl: () => Promise.reject(new TypeError('réseau')), readCookie: () => 'xsrf' });
    const source = createApiOwnerFundsSource({ client, organizationId: api.IDS.org, role: 'owner', kind: 'agency' });
    await expect(source.coverage()).rejects.toBeInstanceOf(ApiUnreachableError);
  });
});

describe('écritures : clé d’idempotence et corps', () => {
  it('crée un lot avec les identifiants et la clé', async () => {
    const { source, callsTo } = build({ [`POST ${funds('/batches')}`]: { status: 201, body: api.batchDraft } });
    const batch = await source.createBatch([api.IDS.mandantA], KEY);
    expect(batch.status).toBe('draft');
    const call = callsTo('POST', funds('/batches'))[0];
    expect(call?.body).toEqual({ mandant_ids: [api.IDS.mandantA] });
    expect(call?.headers.get('Idempotency-Key')).toBe(KEY);
  });

  it('refuse d’écrire sans clé valide, avant tout appel', async () => {
    const { source, calls } = build({});
    await expect(source.createBatch(null, 'court')).rejects.toMatchObject({ kind: 'invalid' });
    expect(calls).toHaveLength(0);
  });

  it('inclut et exclut avec la version du lot', async () => {
    const { source, callsTo } = build({
      [`POST ${funds(`/batches/${api.IDS.batchDraft}/items/${api.IDS.itemB}/include`)}`]: { body: api.batchDraft },
      [`POST ${funds(`/batches/${api.IDS.batchDraft}/items/${api.IDS.itemB}/exclude`)}`]: { body: api.batchDraft },
    });
    await source.includeItem(api.IDS.batchDraft, api.IDS.itemB, 3, KEY);
    await source.excludeItem(api.IDS.batchDraft, api.IDS.itemB, 3, KEY);
    expect(callsTo('POST', funds(`/batches/${api.IDS.batchDraft}/items/${api.IDS.itemB}/include`))[0]?.body).toEqual({ lock_version: 3 });
    expect(callsTo('POST', funds(`/batches/${api.IDS.batchDraft}/items/${api.IDS.itemB}/exclude`))[0]?.body).toEqual({ lock_version: 3 });
  });

  it('valide et annule avec lock_version, motif et clé', async () => {
    const { source, callsTo } = build({
      [`POST ${funds(`/batches/${api.IDS.batchDraft}/validate`)}`]: { body: api.batchValidated },
      [`POST ${funds(`/batches/${api.IDS.batchDraft}/cancel`)}`]: { body: api.batchCancelled },
    });
    const validated = await source.validateBatch(api.IDS.batchDraft, 3, KEY);
    expect(validated.number).toBe('RV-2026-0001');
    expect(validated.secondApproverRequired).toBe(true);
    await source.cancelBatch(api.IDS.batchDraft, '  Erreur de sélection ', 3, KEY);
    expect(callsTo('POST', funds(`/batches/${api.IDS.batchDraft}/validate`))[0]?.body).toEqual({ lock_version: 3 });
    expect(callsTo('POST', funds(`/batches/${api.IDS.batchDraft}/validate`))[0]?.headers.get('Idempotency-Key')).toBe(KEY);
    expect(callsTo('POST', funds(`/batches/${api.IDS.batchDraft}/cancel`))[0]?.body).toEqual({ reason: 'Erreur de sélection', lock_version: 3 });
  });

  it('exécute avec date, référence et reconnaissance du changement de compte', async () => {
    const path = funds(`/batches/${api.IDS.batchValidated}/items/${api.IDS.itemA}/execute`);
    const { source, callsTo } = build({ [`POST ${path}`]: { body: { data: api.itemPaid } } });
    const item = await source.executeItem(api.IDS.batchValidated, api.IDS.itemA, { executedOn: '2026-11-16', reference: 'VIR-1', acknowledgeAccountChange: true }, KEY);
    expect(item.status).toBe('paid');
    expect(item.executedOn).toBe('2026-11-17');
    expect(callsTo('POST', path)[0]?.body).toEqual({ executed_on: '2026-11-16', reference: 'VIR-1', acknowledge_account_change: true });
  });

  it('signale un échec et un retour avec leur motif', async () => {
    const fail = funds(`/batches/${api.IDS.batchValidated}/items/${api.IDS.itemA}/fail`);
    const back = funds(`/batches/${api.IDS.batchValidated}/items/${api.IDS.itemA}/return`);
    const { source, callsTo } = build({ [`POST ${fail}`]: { body: { data: api.itemPending } }, [`POST ${back}`]: { body: { data: api.itemPaid } } });
    await source.failItem(api.IDS.batchValidated, api.IDS.itemA, 'Compte clos', KEY);
    await source.returnItem(api.IDS.batchValidated, api.IDS.itemA, 'Retour de la banque', KEY);
    expect(callsTo('POST', fail)[0]?.body).toEqual({ reason: 'Compte clos' });
    expect(callsTo('POST', back)[0]?.body).toEqual({ reason: 'Retour de la banque' });
  });

  it('pose et lève une retenue', async () => {
    const { source, callsTo } = build({ [`POST ${funds('/holds')}`]: { status: 201, body: api.holdCreated }, [`POST ${funds(`/holds/${api.IDS.hold}/release`)}`]: { body: api.holdReleased } });
    const hold = await source.placeHold({ mandantId: api.IDS.mandantA, kind: 'reserve', amount: '200', currency: 'EUR', reason: 'works_reserve', comment: '' }, KEY);
    expect(hold.kind).toBe('full');
    expect(callsTo('POST', funds('/holds'))[0]?.body).toEqual({ mandant_party_id: api.IDS.mandantA, kind: 'reserve', amount: 20000, reason: 'works_reserve' });
    expect((await source.releaseHold(api.IDS.hold, KEY)).releasedAt).not.toBeNull();
  });

  it('prélève, demande puis confirme un apport', async () => {
    const { source, callsTo } = build({
      [`POST ${funds('/trust/withdrawals')}`]: { status: 201, body: api.transferCreated },
      [`POST ${funds('/trust/deposits')}`]: { status: 201, body: api.depositCreated },
      [`POST ${funds(`/trust/deposits/${api.IDS.deposit}/confirm`)}`]: { body: api.depositConfirmed },
    });
    expect((await source.withdrawFees({ amount: '500', currency: 'EUR', executedOn: '2026-11-16', reference: '' }, KEY)).direction).toBe('withdraw_fees');
    const deposit = await source.requestDeposit({ amount: '1600', currency: 'EUR', executedOn: '2026-11-15', reference: 'VIR-20261115-07' }, KEY);
    expect(deposit.status).toBe('pending');
    expect((await source.confirmDeposit(api.IDS.deposit, KEY)).status).toBe('confirmed');
    expect(callsTo('POST', funds('/trust/withdrawals'))[0]?.body).toEqual({ amount: 50000, executed_on: '2026-11-16' });
    expect(callsTo('POST', funds('/trust/deposits'))[0]?.body).toEqual({ amount: 160000, executed_on: '2026-11-15', reference: 'VIR-20261115-07' });
  });

  it('clôture un mois et renvoie les avertissements', async () => {
    const { source, callsTo } = build({ [`POST ${plain('/accounting/periods/close')}`]: { status: 201, body: api.closedWithWarning } });
    const result = await source.closeMonth('2026-11', KEY);
    expect(result.period.month).toBe('2026-11');
    expect(result.warnings).toEqual(['pending_payouts_older_than_threshold']);
    expect(callsTo('POST', plain('/accounting/periods/close'))[0]?.body).toEqual({ month: '2026-11' });
  });

  it('remonte le refus de clôture avec la liste des motifs', async () => {
    const { source } = build({ [`POST ${plain('/accounting/periods/close')}`]: { status: 409, body: api.problemNotClosable } });
    await expect(source.closeMonth('2026-11', KEY)).rejects.toMatchObject({ kind: 'conflict', code: 'accounting_period_not_closable', reasons: ['trust_funds_gap', 'payouts_in_transit_mismatch'] });
  });

  it('remonte la version périmée et la double authentification avec leur type', async () => {
    const { source } = build({
      [`POST ${funds(`/batches/${api.IDS.batchDraft}/validate`)}`]: { status: 409, body: api.problemStale },
      [`POST ${funds(`/batches/${api.IDS.batchDraft}/cancel`)}`]: { status: 403, body: api.problemTwoFactor },
    });
    await expect(source.validateBatch(api.IDS.batchDraft, 3, KEY)).rejects.toMatchObject({ kind: 'stale' });
    await expect(source.cancelBatch(api.IDS.batchDraft, 'Motif', 3, KEY)).rejects.toMatchObject({ kind: 'two_factor_required' });
  });
});

describe('export CSV', () => {
  const path = funds(`/batches/${api.IDS.batchValidated}/export`);

  it('télécharge le CSV du lot', async () => {
    const { source, fetchImpl } = build({ [`GET ${path}`]: { csv: 'Mandant;Lot;Montant;IBAN\n' } });
    const blob = await source.exportBatch(api.IDS.batchValidated);
    expect(await blob.text()).toContain('Mandant;Lot');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('refuse un contenu qui n’est pas du CSV', async () => {
    const { source } = build({ [`GET ${path}`]: { body: { data: [] } } });
    await expect(source.exportBatch(api.IDS.batchValidated)).rejects.toMatchObject({ kind: 'unexpected_response' });
  });

  it('traduit le refus de double authentification', async () => {
    const { source } = build({ [`GET ${path}`]: { status: 403, body: api.problemTwoFactor } });
    await expect(source.exportBatch(api.IDS.batchValidated)).rejects.toMatchObject({ kind: 'two_factor_required' });
  });

  it('traduit une panne réseau', async () => {
    const client = createApiClient({ baseUrl: 'https://api.test', readCookie: () => 'xsrf' });
    const source = createApiOwnerFundsSource({ client, organizationId: api.IDS.org, role: 'owner', kind: 'agency' }, { fetchImpl: vi.fn<typeof fetch>(() => Promise.reject(new TypeError('réseau'))) });
    await expect(source.exportBatch(api.IDS.batchValidated)).rejects.toBeInstanceOf(ApiUnreachableError);
  });
});
