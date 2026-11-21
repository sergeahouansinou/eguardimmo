import { describe, expect, it } from 'vitest';
import type { PaymentInput } from '../model';
import type { RentRole } from '../permissions';
import { RentApiError } from './rentErrors';
import { createApiRentSource } from './rentSource';
import * as api from './responses.fixtures';
import { mockRentApi, orgPath } from './testing';
import type { MockRoute } from './testing';

const rent = (path: string) => orgPath(api.IDS.org, path);
const NOW = new Date('2026-11-16T10:00:00Z');

function build(routes: Record<string, MockRoute>, role: RentRole | null = 'manager', organizationId: string | null = api.IDS.org) {
  const mock = mockRentApi(routes);
  const source = createApiRentSource({ client: mock.client, organizationId, role }, { now: () => NOW, fetchImpl: mock.fetchImpl });
  return { ...mock, source };
}

const paymentInput = (overrides: Partial<PaymentInput> = {}): PaymentInput => ({
  leaseId: api.IDS.lease,
  amount: '300',
  currency: 'EUR',
  method: 'transfer',
  receivedOn: '2026-11-16',
  reference: 'VIR-123',
  note: 'Virement partiel',
  idempotencyKey: 'cle-partiel-1',
  ...overrides,
});

describe('droits selon le rôle', () => {
  it.each([
    ['owner', true, true],
    ['admin', true, true],
    ['manager', true, true],
    ['accountant', true, false],
    [null, false, false],
  ] as const)('%s : enregistrer un paiement=%s, modifier l’échéancier=%s', (role, recordPayment, manage) => {
    expect(build({}, role).source.permissions).toEqual({ recordPayment, manage });
  });
});

describe('lectures', () => {
  it('liste les échéances avec filtres, curseur et page par défaut', async () => {
    const { source, callsTo } = build({ [`GET ${rent('/installments')}`]: { body: api.upcomingPage } });

    const page = await source.installments({ leaseId: api.IDS.lease, status: 'issued', dueFrom: '2026-11-01', dueTo: '2026-11-30', overdue: true, cursor: 'abc' });

    const search = callsTo('GET', rent('/installments'))[0]?.search;
    expect(Object.fromEntries(search ?? [])).toEqual({ per_page: '25', cursor: 'abc', lease: api.IDS.lease, status: 'issued', due_from: '2026-11-01', due_to: '2026-11-30', overdue: '1' });
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.total).toEqual({ amount: 70000, currency: 'EUR' });
    expect(page.nextCursor).toBeNull();
  });

  it('n’envoie aucun filtre inutile sans critère', async () => {
    const { source, callsTo } = build({ [`GET ${rent('/installments')}`]: { body: api.upcomingPage } });
    await source.installments({});
    expect(Object.fromEntries(callsTo('GET', rent('/installments'))[0]?.search ?? [])).toEqual({ per_page: '25' });
  });

  it('lit le détail d’une échéance avec ses lignes', async () => {
    const { source } = build({ [`GET ${rent(`/installments/${api.IDS.installment}`)}`]: { body: api.paidDetail } });
    const detail = await source.installment(api.IDS.installment);
    expect(detail.lines).toHaveLength(2);
    expect(detail.status).toBe('paid');
  });

  it('lit le solde d’un bail', async () => {
    const { source } = build({ [`GET ${rent(`/leases/${api.IDS.lease}/balance`)}`]: { body: api.balanceAdvance } });
    expect(await source.leaseBalance(api.IDS.lease)).toMatchObject({ advance: { amount: 100000, currency: 'EUR' }, balance: { amount: -100000, currency: 'EUR' }, unpaidCount: 0 });
  });

  it('pagine les paiements par curseur', async () => {
    const { source, callsTo } = build({ [`GET ${rent('/payments')}`]: { body: api.paymentsPage } });
    const page = await source.payments({ leaseId: api.IDS.lease, status: 'recorded' });
    expect(Object.fromEntries(callsTo('GET', rent('/payments'))[0]?.search ?? [])).toEqual({ per_page: '25', lease: api.IDS.lease, status: 'recorded' });
    expect(page.items.map((payment) => payment.amount.amount)).toEqual([100000, 40000]);
    expect(page.nextCursor).toBe(api.paymentsPage.meta.next_cursor);
  });

  it('liste les quittances et lit une quittance', async () => {
    const { source } = build({
      [`GET ${rent('/receipts')}`]: { body: api.receiptsPage },
      [`GET ${rent(`/receipts/${api.IDS.receipt}`)}`]: { body: api.receiptDetail },
    });
    expect((await source.receipts({})).items[0]?.snapshot).toBeNull();
    expect((await source.receipt(api.IDS.receipt)).snapshot?.lines).toHaveLength(2);
  });
});

describe('écritures', () => {
  it('enregistre un paiement avec un montant entier en unités mineures et sans devise', async () => {
    const { source, callsTo } = build({ [`POST ${rent('/payments')}`]: { status: 201, body: api.paymentPartial } }, 'accountant');

    const payment = await source.recordPayment(paymentInput());

    expect(callsTo('POST', rent('/payments'))[0]?.body).toEqual({
      lease_id: api.IDS.lease,
      amount: 30000,
      method: 'transfer',
      received_on: '2026-11-16',
      reference: 'VIR-123',
      note: 'Virement partiel',
      idempotency_key: 'cle-partiel-1',
    });
    expect(payment.amount).toEqual({ amount: 30000, currency: 'EUR' });
    expect(payment.replayed).toBe(false);
  });

  it('reconnaît le rejeu d’un encaissement déjà enregistré', async () => {
    const { source } = build({ [`POST ${rent('/payments')}`]: { status: 200, body: api.paymentReplay } });
    expect((await source.recordPayment(paymentInput())).replayed).toBe(true);
  });

  it('refuse un montant invalide sans appeler le serveur', async () => {
    const { source, calls } = build({});
    await expect(source.recordPayment(paymentInput({ amount: '12,345' }))).rejects.toMatchObject({ kind: 'invalid' });
    expect(calls).toHaveLength(0);
  });

  it('traduit la clé d’idempotence réutilisée avec un autre contenu', async () => {
    const { source } = build({ [`POST ${rent('/payments')}`]: { status: 409, body: api.problemKeyReused } });
    await expect(source.recordPayment(paymentInput({ amount: '300,01' }))).rejects.toMatchObject({
      kind: 'conflict',
      status: 409,
      code: 'rent_idempotency_key_reused',
      message: 'Cet encaissement a déjà été saisi avec un contenu différent. Rechargez le formulaire pour en saisir un nouveau.',
    });
  });

  it('annule un paiement avec son motif', async () => {
    const { source, callsTo } = build({ [`POST ${rent(`/payments/${api.IDS.paymentPartial}/cancel`)}`]: { body: api.paymentCancelled } });
    const cancelled = await source.cancelPayment(api.IDS.paymentPartial, '  Chèque rejeté ');
    expect(callsTo('POST', rent(`/payments/${api.IDS.paymentPartial}/cancel`))[0]?.body).toEqual({ reason: 'Chèque rejeté' });
    expect(cancelled).toMatchObject({ status: 'cancelled', advance: null });
  });

  it('refuse un motif trop court sans appeler le serveur', async () => {
    const { source, calls } = build({});
    await expect(source.cancelPayment(api.IDS.paymentPartial, ' x ')).rejects.toMatchObject({ kind: 'invalid', message: 'Le motif doit contenir entre 2 et 255 caractères.' });
    expect(calls).toHaveLength(0);
  });

  it('génère les échéances d’un bail', async () => {
    const { source, callsTo } = build({ [`POST ${rent(`/leases/${api.IDS.lease}/installments/generate`)}`]: { body: api.generation } });
    expect(await source.generateInstallments(api.IDS.lease)).toEqual({ created: 1, existing: 1 });
    expect(callsTo('POST', rent(`/leases/${api.IDS.lease}/installments/generate`))).toHaveLength(1);
  });

  it('émet un avis puis renvoie l’échéance mise à jour', async () => {
    const { source } = build({ [`POST ${rent(`/installments/${api.IDS.installment}/issue`)}`]: { body: api.issuedDetail } });
    expect(await source.issueNotice(api.IDS.installment)).toMatchObject({ status: 'issued', outstanding: { amount: 70000, currency: 'EUR' }, notice: { number: 'AV-2026-0001' } });
  });

  it('émet les avis échus par lot de 100 au plus et ne montre que les identifiants en échec', async () => {
    const { source, callsTo } = build({ [`POST ${rent('/installments/issue-due')}`]: { body: api.batchFailed } });
    const outcome = await source.issueDueNotices();
    expect(callsTo('POST', rent('/installments/issue-due'))[0]?.body).toEqual({ limit: 100 });
    expect(outcome).toEqual({ issued: 0, failed: [{ installmentId: api.IDS.janInstallment }], remaining: false });
  });

  it('annule une échéance avec son motif', async () => {
    const { source, callsTo } = build({ [`POST ${rent(`/installments/${api.IDS.janInstallment}/cancel`)}`]: { body: api.cancelledDetail } });
    expect(await source.cancelInstallment(api.IDS.janInstallment, 'Erreur de génération')).toMatchObject({ status: 'cancelled' });
    expect(callsTo('POST', rent(`/installments/${api.IDS.janInstallment}/cancel`))[0]?.body).toEqual({ reason: 'Erreur de génération' });
  });

  it('traduit le refus d’annuler une échéance déjà encaissée', async () => {
    const { source } = build({ [`POST ${rent(`/installments/${api.IDS.installment}/cancel`)}`]: { status: 409, body: api.problemHasPayments } });
    await expect(source.cancelInstallment(api.IDS.installment, 'Erreur')).rejects.toMatchObject({ kind: 'conflict', code: 'rent_installment_has_payments' });
  });

  it('émet une quittance à la demande', async () => {
    const { source } = build({ [`POST ${rent(`/installments/${api.IDS.installment}/receipt`)}`]: { status: 201, body: api.receiptDetail } });
    expect(await source.issueReceipt(api.IDS.installment)).toMatchObject({ number: 'QT-2026-0001' });
  });

  it('traduit le refus d’une quittance sur une échéance non soldée', async () => {
    const { source } = build({ [`POST ${rent(`/installments/${api.IDS.janInstallment}/receipt`)}`]: { status: 409, body: api.problemNotPaid } });
    await expect(source.issueReceipt(api.IDS.janInstallment)).rejects.toMatchObject({ code: 'rent_installment_not_paid', message: 'Une quittance ne s’émet que pour une échéance entièrement soldée.' });
  });

  it('émet les quittances en attente par lot', async () => {
    const { source, callsTo } = build({ [`POST ${rent('/receipts/issue-pending')}`]: { body: api.batchEmpty } });
    expect(await source.issuePendingReceipts()).toEqual({ issued: 0, failed: [], remaining: false });
    expect(callsTo('POST', rent('/receipts/issue-pending'))[0]?.body).toEqual({ limit: 100 });
  });
});

describe('erreurs de lecture', () => {
  it('traduit 403 et 404', async () => {
    const { source } = build({
      [`GET ${rent(`/installments/${api.IDS.installment}`)}`]: { status: 404, body: api.problemNotFound },
      [`POST ${rent(`/installments/${api.IDS.installment}/issue`)}`]: { status: 403, body: api.problemForbidden },
    });
    await expect(source.installment(api.IDS.installment)).rejects.toMatchObject({ kind: 'not_found', message: 'Cette échéance n’existe pas dans votre organisation.' });
    await expect(source.issueNotice(api.IDS.installment)).rejects.toMatchObject({ kind: 'forbidden', message: 'Votre rôle ne permet pas cette action sur les loyers.' });
  });

  it('signale une réponse qui ne respecte pas le contrat au lieu d’afficher des données partielles', async () => {
    const broken = { data: { ...api.paidDetail.data, amounts: { ...api.paidDetail.data.amounts, total: { amount: 700.5, currency: 'EUR' } } } };
    const { source } = build({ [`GET ${rent(`/installments/${api.IDS.installment}`)}`]: { body: broken } });
    await expect(source.installment(api.IDS.installment)).rejects.toMatchObject({ kind: 'unexpected_response' });
  });

  it('refuse toute requête sans organisation sélectionnée', async () => {
    const { source, calls } = build({}, 'manager', null);
    await expect(source.installments({})).rejects.toMatchObject({ kind: 'no_organization' });
    expect(calls).toHaveLength(0);
  });

  it('refuse une devise inconnue plutôt que de l’afficher en euros', async () => {
    const usd = { data: { ...api.balanceAdvance.data, balance: { amount: 1, currency: 'USD' } } };
    const { source } = build({ [`GET ${rent(`/leases/${api.IDS.lease}/balance`)}`]: { body: usd } });
    await expect(source.leaseBalance(api.IDS.lease)).rejects.toMatchObject({ kind: 'unsupported' });
  });
});

describe('téléchargement des PDF', () => {
  it('télécharge l’avis par le client authentifié, avec les cookies de session', async () => {
    const path = rent(`/installments/${api.IDS.installment}/notice/download`);
    const { source, calls, fetchImpl } = build({ [`GET ${path}`]: { pdf: api.PDF_BYTES } });

    const blob = await source.noticePdf(api.IDS.installment);

    expect(blob.type).toBe('application/pdf');
    expect(await blob.text()).toBe(api.PDF_BYTES);
    expect(calls[0]?.headers.get('Accept')).toBe('application/pdf');
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({ credentials: 'include' });
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(`https://api.test${path}`);
  });

  it('télécharge la quittance', async () => {
    const path = rent(`/receipts/${api.IDS.receipt}/download`);
    const { source } = build({ [`GET ${path}`]: { pdf: api.PDF_BYTES } });
    expect(await (await source.receiptPdf(api.IDS.receipt)).text()).toBe(api.PDF_BYTES);
  });

  it('traduit l’absence d’avis en erreur claire', async () => {
    const path = rent(`/installments/${api.IDS.janInstallment}/notice/download`);
    const { source } = build({ [`GET ${path}`]: { status: 404, body: { ...api.problemNotFound, code: 'rent_notice_not_found' } } });
    await expect(source.noticePdf(api.IDS.janInstallment)).rejects.toMatchObject({ kind: 'not_found', message: 'Aucun avis d’échéance n’a encore été émis pour cette échéance.' });
  });

  it('annonce le délai quand le service PDF est indisponible', async () => {
    const path = rent(`/receipts/${api.IDS.receipt}/download`);
    const { source } = build({ [`GET ${path}`]: { status: 503, body: api.problemPdfUnavailable, headers: { 'Retry-After': '30' } } });
    await expect(source.receiptPdf(api.IDS.receipt)).rejects.toMatchObject({ kind: 'unavailable', message: expect.stringContaining('réessayez dans 30 secondes') as string });
  });

  it('refuse une réponse qui n’est pas un PDF', async () => {
    const path = rent(`/receipts/${api.IDS.receipt}/download`);
    const { source } = build({ [`GET ${path}`]: { status: 200, body: { data: 'html' } } });
    await expect(source.receiptPdf(api.IDS.receipt)).rejects.toBeInstanceOf(RentApiError);
  });
});
