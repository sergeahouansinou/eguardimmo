import { describe, expect, it } from 'vitest';
import type { DraftInput } from '../model';
import type { InvoicingOrganizationKind, InvoicingRole } from '../permissions';
import { InvoicingApiError } from './invoicingErrors';
import { createApiInvoicingSource } from './invoicingSource';
import * as api from './responses.fixtures';
import { mockInvoicingApi, orgPath } from './testing';
import type { MockRoute } from './testing';

const invoices = (path = '') => orgPath(api.IDS.org, `/invoices${path}`);
const NOW = new Date('2026-11-16T10:00:00Z');

function build(routes: Record<string, MockRoute>, role: InvoicingRole | null = 'accountant', kind: InvoicingOrganizationKind | null = 'agency', organizationId: string | null = api.IDS.org) {
  const mock = mockInvoicingApi(routes);
  const source = createApiInvoicingSource({ client: mock.client, organizationId, role, kind }, { now: () => NOW, fetchImpl: mock.fetchImpl });
  return { ...mock, source };
}

const draftInput = (overrides: Partial<DraftInput> = {}): DraftInput => ({
  invoiceId: null,
  lockVersion: null,
  idempotencyKey: 'brouillon-cle-1',
  recipientPartyId: api.IDS.party,
  leaseId: null,
  mandateId: null,
  currency: 'EUR',
  dueOn: '',
  serviceFrom: '',
  serviceTo: '',
  lines: [{ itemTermId: api.IDS.term, description: 'Honoraires', quantity: '1', unitPrice: '100', taxCategory: 'S' }],
  ...overrides,
});

describe('lectures', () => {
  it('liste avec filtres, curseur et page par défaut', async () => {
    const { source, callsTo } = build({ [`GET ${invoices()}`]: { body: api.invoicesPage } });

    const page = await source.invoices({ kind: 'invoice', status: 'issued', year: 2026, search: 'FA-2026', overdue: true, partyId: api.IDS.party, cursor: 'abc' });

    expect(Object.fromEntries(callsTo('GET', invoices())[0]?.search ?? [])).toEqual({ per_page: '25', cursor: 'abc', kind: 'invoice', status: 'issued', year: '2026', search: 'FA-2026', overdue: '1', party: api.IDS.party });
    expect(page.items).toHaveLength(5);
    expect(page.items[1]).toMatchObject({ number: 'FA-2026-0001', isOverdue: true, outstanding: { amount: 12000 } });
    expect(page.nextCursor).toBeNull();
  });

  it('n’envoie aucun filtre inutile sans critère', async () => {
    const { source, callsTo } = build({ [`GET ${invoices()}`]: { body: api.invoicesPage } });
    await source.invoices({});
    expect(Object.fromEntries(callsTo('GET', invoices())[0]?.search ?? [])).toEqual({ per_page: '25' });
  });

  it('lit le détail avec lignes, taxes et règlements', async () => {
    const { source } = build({ [`GET ${invoices(`/${api.IDS.partial}`)}`]: { body: api.partialDetail } });
    const detail = await source.invoice(api.IDS.partial);
    expect(detail.lines).toHaveLength(1);
    expect(detail.payments).toHaveLength(1);
  });

  it('encode un identifiant dans le chemin', async () => {
    const { source, calls } = build({});
    await expect(source.invoice('a/b?c')).rejects.toBeInstanceOf(Error);
    expect(calls[0]?.path).toBe(invoices('/a%2Fb%3Fc'));
  });

  it('charge toutes les parties, y compris archivées, par curseur, triées par nom', async () => {
    const { source, callsTo } = build({
      [`GET ${orgPath(api.IDS.org, '/parties')}`]: (call) =>
        call.search.get('cursor') === null ? { body: { ...api.partiesPage, meta: { ...api.partiesPage.meta, next_cursor: 'page2' } } } : { body: { ...api.partiesPage, data: [{ ...api.partiesPage.data[1], id: '01a1ee5a-0bb7-73fa-a273-ea6cbd9aa699', display_name: 'Alice Durand' }], meta: { ...api.partiesPage.meta, next_cursor: null } } },
    });
    const recipients = await source.recipients();
    expect(recipients.map((party) => party.name)).toEqual(['Alice Durand', 'Danielle Martin', 'SCI Les Tilleuls']);
    expect(callsTo('GET', orgPath(api.IDS.org, '/parties'))[0]?.search.get('status')).toBe('all');
    expect(callsTo('GET', orgPath(api.IDS.org, '/parties'))).toHaveLength(2);
  });

  it('lit les natures de ligne du référentiel de l’organisation', async () => {
    const { source } = build({ [`GET ${orgPath(api.IDS.org, '/catalog/vocabularies/invoice_item/terms')}`]: { body: { data: [...api.itemTerms.data, { ...api.itemTerms.data[0], id: api.IDS.otherParty, archived: true }] } } });
    expect((await source.itemTerms()).map((term) => term.label)).toEqual(['Honoraires de gestion', 'Prestation de services']);
  });
});

describe('écritures', () => {
  it('crée un brouillon avec clé d’idempotence et sans aucun champ calculé par le serveur', async () => {
    const { source, callsTo } = build({ [`POST ${invoices()}`]: { status: 201, body: api.draftCreated } });
    const created = await source.saveDraft(draftInput());
    expect(created).toMatchObject({ status: 'draft', number: null, replayed: false });
    const body = callsTo('POST', invoices())[0]?.body as Record<string, unknown>;
    expect(body).toMatchObject({ recipient_party_id: api.IDS.party, idempotency_key: 'brouillon-cle-1', lines: [{ quantity_milli: 1000, unit_price: 10000, tax_category: 'S' }] });
    expect(Object.keys(body).sort()).toEqual(['due_on', 'idempotency_key', 'lease_id', 'lines', 'mandate_id', 'recipient_party_id', 'service_from', 'service_to']);
  });

  it('modifie un brouillon par PATCH avec sa version', async () => {
    const { source, callsTo } = build({ [`PATCH ${invoices(`/${api.IDS.draft}`)}`]: { body: api.draftUpdated } });
    const updated = await source.saveDraft(draftInput({ invoiceId: api.IDS.draft, lockVersion: 0, idempotencyKey: null }));
    expect(updated.lockVersion).toBe(1);
    expect(callsTo('PATCH', invoices(`/${api.IDS.draft}`))[0]?.body).toMatchObject({ lock_version: 0 });
  });

  it('signale un brouillon modifié entre-temps', async () => {
    const { source } = build({ [`PATCH ${invoices(`/${api.IDS.draft}`)}`]: { status: 409, body: api.problemStaleVersion } });
    await expect(source.saveDraft(draftInput({ invoiceId: api.IDS.draft, lockVersion: 0, idempotencyKey: null }))).rejects.toMatchObject({ kind: 'conflict', code: 'invoice_stale_version' });
  });

  it('n’appelle pas le réseau pour un brouillon invalide', async () => {
    const { source, calls } = build({});
    await expect(source.saveDraft(draftInput({ lines: [] }))).rejects.toBeInstanceOf(InvoicingApiError);
    expect(calls).toHaveLength(0);
  });

  it('abandonne et émet par POST sans corps', async () => {
    const { source, callsTo } = build({
      [`POST ${invoices(`/${api.IDS.draft}/discard`)}`]: { body: api.draftDiscarded },
      [`POST ${invoices(`/${api.IDS.draft}/issue`)}`]: { status: 201, body: api.issuedNow },
    });
    expect((await source.discardDraft(api.IDS.draft)).status).toBe('discarded');
    const issued = await source.issue(api.IDS.draft);
    expect(issued).toMatchObject({ status: 'issued', number: 'FA-2026-0001', replayed: false });
    expect(callsTo('POST', invoices(`/${api.IDS.draft}/issue`))[0]?.body).toBeNull();
  });

  it('relaie l’identité légale incomplète de l’émetteur', async () => {
    const { source } = build({ [`POST ${invoices(`/${api.IDS.draft}/issue`)}`]: { status: 422, body: api.problemIssuerIncomplete } });
    await expect(source.issue(api.IDS.draft)).rejects.toMatchObject({ kind: 'invalid', code: 'invoice_issuer_incomplete', message: expect.stringContaining('identité légale') as unknown });
  });

  it('enregistre un règlement avec montant en unités mineures et clé, puis le rejoue', async () => {
    const { source, callsTo } = build({ [`POST ${invoices(`/${api.IDS.issued}/payments`)}`]: { status: 201, body: api.paymentRecorded } });
    const input = { amount: '50', currency: 'EUR', method: 'transfer', paidOn: '2026-11-16', reference: 'VIR-123', idempotencyKey: 'reglement-cle-1' } as const;
    expect(await source.recordPayment(api.IDS.issued, input)).toMatchObject({ amount: { amount: 5000, currency: 'EUR' }, replayed: false });
    expect(callsTo('POST', invoices(`/${api.IDS.issued}/payments`))[0]?.body).toEqual({ amount: 5000, method: 'transfer', paid_on: '2026-11-16', reference: 'VIR-123', idempotency_key: 'reglement-cle-1' });
  });

  it('annule un règlement sans corps', async () => {
    const { source, callsTo } = build({ [`POST ${orgPath(api.IDS.org, `/invoice-payments/${api.IDS.payment}/cancel`)}`]: { body: api.paymentCancelled } });
    expect((await source.cancelPayment(api.IDS.payment)).cancelledAt).not.toBeNull();
    expect(callsTo('POST', orgPath(api.IDS.org, `/invoice-payments/${api.IDS.payment}/cancel`))[0]?.body).toBeNull();
  });

  it('émet un avoir partiel avec quantités en millièmes et motif', async () => {
    const { source, callsTo } = build({ [`POST ${invoices(`/${api.IDS.issued}/credit-notes`)}`]: { status: 201, body: api.creditNoteDetail } });
    const note = await source.createCreditNote(api.IDS.issued, { reason: 'Remise commerciale', full: false, lines: [{ lineId: api.IDS.line, quantity: '0,5' }], idempotencyKey: 'avoir-cle-0001' });
    expect(note).toMatchObject({ kind: 'credit_note', number: 'AF-2026-0001' });
    expect(callsTo('POST', invoices(`/${api.IDS.issued}/credit-notes`))[0]?.body).toEqual({ reason: 'Remise commerciale', full: false, lines: [{ line_id: api.IDS.line, quantity_milli: 500 }], idempotency_key: 'avoir-cle-0001' });
  });

  it('envoie par e-mail et signale l’absence d’adresse', async () => {
    const ok = build({ [`POST ${invoices(`/${api.IDS.issued}/send`)}`]: { body: api.sentInvoice } });
    expect((await ok.source.send(api.IDS.issued)).sentAt).toBe('2026-11-16T11:00:00+00:00');
    const missing = build({ [`POST ${invoices(`/${api.IDS.issued}/send`)}`]: { status: 422, body: api.problemRecipientEmailMissing } });
    await expect(missing.source.send(api.IDS.issued)).rejects.toMatchObject({ code: 'invoice_recipient_email_missing' });
  });
});

describe('limites d’envoi', () => {
  const sendPath = invoices(`/${api.IDS.issued}/send`);

  it('traduit le 429 de l’envoi avec les plafonds et le délai en minutes', async () => {
    const { source } = build({ [`POST ${sendPath}`]: { status: 429, body: api.problemSendThrottled, headers: { 'Retry-After': '1800' } } });
    await expect(source.send(api.IDS.issued)).rejects.toMatchObject({
      kind: 'rate_limited',
      status: 429,
      message: 'Limite d’envois atteinte : 3 envois par heure pour une même facture, 60 par heure pour l’organisation. Aucun e-mail n’a été mis en file : réessayez dans 30 minutes.',
    });
  });

  it('reste générique sans délai du serveur, et ne touche pas aux autres erreurs d’envoi', async () => {
    const noDelay = build({ [`POST ${sendPath}`]: { status: 429, body: api.problemThrottled } });
    await expect(noDelay.source.send(api.IDS.issued)).rejects.toMatchObject({ kind: 'rate_limited', message: expect.stringContaining('réessayez un peu plus tard') as unknown });
    const missing = build({ [`POST ${sendPath}`]: { status: 404, body: api.problemNotFound } });
    await expect(missing.source.send(api.IDS.issued)).rejects.toMatchObject({ kind: 'not_found' });
  });

  it('garde le message générique du 429 pour les autres actions', async () => {
    const { source } = build({ [`POST ${invoices(`/${api.IDS.issued}/issue`)}`]: { status: 429, body: api.problemSendThrottled } });
    await expect(source.issue(api.IDS.issued)).rejects.toMatchObject({ kind: 'rate_limited', message: 'Trop de requêtes en peu de temps. Patientez quelques secondes puis réessayez.' });
  });
});

describe('PDF', () => {
  it('télécharge avec Accept application/pdf', async () => {
    const { source, callsTo } = build({ [`GET ${invoices(`/${api.IDS.issued}/pdf`)}`]: { pdf: api.PDF_BYTES } });
    const blob = await source.pdf(api.IDS.issued);
    expect(blob.type).toBe('application/pdf');
    expect(callsTo('GET', invoices(`/${api.IDS.issued}/pdf`))[0]?.headers.get('Accept')).toBe('application/pdf');
  });

  it('traduit un 503 Gotenberg avec le délai', async () => {
    const { source } = build({ [`GET ${invoices(`/${api.IDS.issued}/pdf`)}`]: { status: 503, body: api.problemPdfUnavailable, headers: { 'Retry-After': '30' } } });
    await expect(source.pdf(api.IDS.issued)).rejects.toMatchObject({ kind: 'unavailable', message: expect.stringContaining('dans 30 secondes') as unknown });
  });

  it('refuse une réponse qui n’est pas un PDF', async () => {
    const { source } = build({ [`GET ${invoices(`/${api.IDS.issued}/pdf`)}`]: { body: {} } });
    await expect(source.pdf(api.IDS.issued)).rejects.toMatchObject({ kind: 'unexpected_response' });
  });
});

describe('états d’erreur', () => {
  it.each([
    [401, api.problemForbidden, 'unauthenticated'],
    [403, api.problemForbidden, 'forbidden'],
    [403, api.problemAgencyOnly, 'agency_only'],
    [404, api.problemNotFound, 'not_found'],
    [422, api.problemValidation('year'), 'invalid'],
    [429, api.problemThrottled, 'rate_limited'],
    [503, api.problemPdfUnavailable, 'unavailable'],
  ] as const)('%i → %s', async (status, body, kind) => {
    const { source } = build({ [`GET ${invoices()}`]: { status, body } });
    await expect(source.invoices({})).rejects.toMatchObject({ kind });
  });

  it('sans organisation, n’appelle jamais le réseau', async () => {
    const { source, calls } = build({}, 'owner', 'agency', null);
    await expect(source.invoices({})).rejects.toMatchObject({ kind: 'no_organization' });
    expect(calls).toHaveLength(0);
  });

  it('refuse une réponse de forme inattendue', async () => {
    const { source } = build({ [`GET ${invoices()}`]: { body: { data: [{ id: 'x' }], meta: {} } } });
    await expect(source.invoices({})).rejects.toMatchObject({ kind: 'unexpected_response' });
  });
});

describe('droits', () => {
  it('ouvre la facturation à une agence et la ferme à une organisation individuelle', () => {
    expect(build({}, 'manager', 'agency').source.permissions).toEqual({ available: true, write: true, credit: false });
    expect(build({}, 'owner', 'individual').source.permissions.available).toBe(false);
  });
});
