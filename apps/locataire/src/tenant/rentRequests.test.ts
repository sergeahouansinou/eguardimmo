import { ApiError, ApiUnreachableError, createApiClient } from '@eguardimmo/api';
import { describe, expect, it, vi } from 'vitest';
import { UnexpectedResponseError, describeFailure } from './errors';
import { formatApiMoney } from './format';
import {
  fetchInstallment,
  fetchInstallmentsPage,
  fetchPayment,
  fetchPaymentsPage,
  fetchPdf,
  fetchReceipt,
  fetchReceiptsPage,
  noticePdfPath,
  receiptPdfPath,
} from './rentRequests';
import {
  REAL_IDS,
  installmentIssuedDetail,
  installmentsAll,
  installmentsIssuedPage1,
  installmentPaidDetail,
  paymentPartialDetail,
  paymentsWithCancelled,
  receiptDetail,
  receiptVoidDetail,
  receiptVoidProblem,
  receiptsList,
} from './rentResponses.fixtures';

interface Seen {
  url: URL;
  init: RequestInit | undefined;
}

function clientFor(reply: () => Response) {
  const seen: Seen[] = [];
  const fetchImpl = vi.fn<typeof fetch>((input, init) => {
    seen.push({ url: new URL(input instanceof Request ? input.url : String(input)), init });
    return Promise.resolve(reply());
  });
  return { client: createApiClient({ baseUrl: 'http://api.test', fetchImpl, readCookie: () => 'xsrf' }), seen, fetchImpl };
}

const json = (body: unknown, status = 200) => () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const clone = <T,>(value: T): T => structuredClone(value);
const NONE = { leaseId: null, status: null } as const;

function withCharges<T>(body: T): T {
  const copy = JSON.stringify(body)
    .replaceAll('"charges":{"amount":0', '"charges":{"amount":5000')
    .replaceAll('"total":{"amount":65000', '"total":{"amount":70000');
  return JSON.parse(copy) as T;
}

describe('échéances du locataire', () => {
  it('lit la liste réelle sans filtre et mappe chaque champ', async () => {
    const { client, seen } = clientFor(json(installmentsAll));

    const page = await fetchInstallmentsPage(client, NONE, null);

    expect(seen[0]?.url.pathname).toBe('/api/v1/tenant/rent/installments');
    expect(seen[0]?.url.search).toBe('');
    expect(page.nextCursor).toBeNull();
    expect(page.items).toHaveLength(2);
    expect(page.items[1]).toEqual({
      id: REAL_IDS.installment,
      lease: { id: REAL_IDS.lease, reference: 'BL-2026-99809' },
      periodStart: '2026-11-01',
      periodEnd: '2026-11-30',
      dueOn: '2026-11-05',
      status: 'issued',
      isOverdue: true,
      amounts: {
        rent: { amount: 65000, currency: 'EUR' },
        charges: { amount: 0, currency: 'EUR' },
        vat: { amount: 0, currency: 'EUR' },
        total: { amount: 65000, currency: 'EUR' },
      },
      outstanding: { amount: 65000, currency: 'EUR' },
      issuedOn: '2026-11-16',
      notice: { number: 'AV-2026-0001', issuedOn: '2026-11-16' },
      receipt: null,
      lines: null,
    });
  });

  it('transmet bail, statut et curseur du serveur, et signale la page suivante', async () => {
    const { client, seen } = clientFor(json(installmentsIssuedPage1));

    const page = await fetchInstallmentsPage(client, { leaseId: REAL_IDS.lease, status: 'partially_paid' }, 'curseur-1');

    expect(seen[0]?.url.searchParams.get('lease')).toBe(REAL_IDS.lease);
    expect(seen[0]?.url.searchParams.get('status')).toBe('partially_paid');
    expect(seen[0]?.url.searchParams.get('cursor')).toBe('curseur-1');
    expect(page.nextCursor).toBe(installmentsIssuedPage1.meta.next_cursor);
    expect(page.nextCursor).not.toBeNull();
  });

  it('ne répartit pas un montant d’une composante sur une autre', async () => {
    const { client } = clientFor(json(withCharges(installmentsAll)));

    const [, first] = (await fetchInstallmentsPage(client, NONE, null)).items;

    expect(first?.amounts.rent.amount).toBe(65000);
    expect(first?.amounts.charges.amount).toBe(5000);
    expect(first?.amounts.vat.amount).toBe(0);
    expect(first?.amounts.total.amount).toBe(70000);
  });

  it('lit le détail avec ses lignes et le reste dû d’une échéance soldée', async () => {
    const { client, seen } = clientFor(json(installmentPaidDetail));

    const installment = await fetchInstallment(client, REAL_IDS.installment);

    expect(seen[0]?.url.pathname).toBe(`/api/v1/tenant/rent/installments/${REAL_IDS.installment}`);
    expect(installment).toMatchObject({
      status: 'paid',
      isOverdue: false,
      outstanding: { amount: 0, currency: 'EUR' },
      receipt: { id: REAL_IDS.receipt, number: 'QT-2026-0001', issuedOn: '2026-11-16' },
    });
    expect(installment.lines).toEqual([
      {
        label: 'Loyer de novembre 2026',
        from: '2026-11-01',
        to: '2026-11-30',
        days: 30,
        monthDays: 30,
        amount: { amount: 65000, currency: 'EUR' },
        vatBasisPoints: 0,
        vatAmount: { amount: 0, currency: 'EUR' },
      },
    ]);
  });

  it('garde une échéance sans avis ni quittance, et un reste dû inconnu', async () => {
    const body = clone(installmentIssuedDetail);
    Object.assign(body.data, { notice: null, outstanding: null });

    const installment = await fetchInstallment(clientFor(json(body)).client, REAL_IDS.installment);

    expect(installment.notice).toBeNull();
    expect(installment.outstanding).toBeNull();
  });

  it('lit un bail en franc CFA sans décimales', async () => {
    const xof = JSON.parse(JSON.stringify(installmentIssuedDetail).replaceAll('EUR', 'XOF')) as typeof installmentIssuedDetail;

    const installment = await fetchInstallment(clientFor(json(xof)).client, REAL_IDS.installment);

    expect(installment.amounts.total).toEqual({ amount: 65000, currency: 'XOF' });
    expect(formatApiMoney(installment.amounts.total)).toMatch(/^65 000\s(F\s?CFA|FCFA|CFA)/);
  });

  it.each([
    ['un statut annulé', (body: typeof installmentsAll) => { Object.assign(body.data[0] ?? {}, { status: 'cancelled' }); }],
    ['un montant décimal', (body: typeof installmentsAll) => { Object.assign(body.data[0]?.amounts.total ?? {}, { amount: 650.5 }); }],
    ['une échéance sans montants', (body: typeof installmentsAll) => { Object.assign(body.data[0] ?? {}, { amounts: undefined }); }],
    ['un identifiant invalide', (body: typeof installmentsAll) => { Object.assign(body.data[0] ?? {}, { id: '12' }); }],
  ])('refuse %s', async (_name, break_) => {
    const body = clone(installmentsAll);
    break_(body);

    await expect(fetchInstallmentsPage(clientFor(json(body)).client, NONE, null)).rejects.toBeInstanceOf(UnexpectedResponseError);
  });
});

describe('quittances du locataire', () => {
  it('lit la liste : une quittance valable, sans émetteur ni date de paiement', async () => {
    const { client, seen } = clientFor(json(receiptsList));

    const page = await fetchReceiptsPage(client, REAL_IDS.lease, null);

    expect(seen[0]?.url.pathname).toBe('/api/v1/tenant/rent/receipts');
    expect(seen[0]?.url.searchParams.get('lease')).toBe(REAL_IDS.lease);
    expect(page.items[0]).toEqual({
      id: REAL_IDS.receipt,
      number: 'QT-2026-0001',
      lease: { id: REAL_IDS.lease, reference: 'BL-2026-99809' },
      installmentId: REAL_IDS.installment,
      issuer: null,
      tenants: ['Louis Carlier'],
      unit: { reference: 'LOT-23892', propertyName: 'Résidence Fournier', address: '12 rue du Port, 13002 Marseille' },
      periodStart: '2026-11-01',
      periodEnd: '2026-11-30',
      amounts: {
        rent: { amount: 65000, currency: 'EUR' },
        charges: { amount: 0, currency: 'EUR' },
        vat: { amount: 0, currency: 'EUR' },
        total: { amount: 65000, currency: 'EUR' },
      },
      issuedOn: '2026-11-16',
      isVoid: false,
      voidedAt: null,
      paidOn: null,
    });
  });

  it('lit le détail et une quittance annulée', async () => {
    const valid = await fetchReceipt(clientFor(json(receiptDetail)).client, REAL_IDS.receipt);
    const voided = await fetchReceipt(clientFor(json(receiptVoidDetail)).client, REAL_IDS.receipt);

    expect(valid).toMatchObject({ issuer: 'Agence du Port', paidOn: '2026-11-16', isVoid: false, voidedAt: null });
    expect(voided).toMatchObject({ isVoid: true, voidedAt: '2026-11-16T10:00:00+00:00' });
  });

  it('accepte un instantané sans lot ni période', async () => {
    const body = clone(receiptDetail);
    Object.assign(body.data, { unit: null, period: null, installment_id: null });

    const receipt = await fetchReceipt(clientFor(json(body)).client, REAL_IDS.receipt);

    expect(receipt).toMatchObject({ unit: null, periodStart: null, periodEnd: null, installmentId: null });
  });

  it('refuse un état d’annulation absent', async () => {
    const body = clone(receiptDetail);
    Object.assign(body.data, { is_void: undefined });

    await expect(fetchReceipt(clientFor(json(body)).client, REAL_IDS.receipt)).rejects.toBeInstanceOf(UnexpectedResponseError);
  });
});

describe('paiements du locataire', () => {
  it('lit la liste, annulés compris, avec la répartition', async () => {
    const { client, seen } = clientFor(json(paymentsWithCancelled));

    const page = await fetchPaymentsPage(client, null, null);

    expect(seen[0]?.url.pathname).toBe('/api/v1/tenant/rent/payments');
    expect(page.items.map((payment) => [payment.status, payment.method, payment.amount.amount, payment.allocations?.length])).toEqual([
      ['cancelled', 'transfer', 35000, 0],
      ['recorded', 'transfer', 30000, 1],
    ]);
    expect(page.items[1]).toEqual({
      id: REAL_IDS.payment1,
      lease: { id: REAL_IDS.lease, reference: 'BL-2026-99809' },
      status: 'recorded',
      method: 'transfer',
      amount: { amount: 30000, currency: 'EUR' },
      receivedOn: '2026-11-16',
      cancelledOn: null,
      allocations: [{ installmentId: REAL_IDS.installment, amount: { amount: 30000, currency: 'EUR' } }],
    });
    expect(page.items[0]?.cancelledOn).toBe('2026-11-16');
  });

  it('lit le détail d’un paiement partiel', async () => {
    const payment = await fetchPayment(clientFor(json(paymentPartialDetail)).client, REAL_IDS.payment1);

    expect(payment.amount).toEqual({ amount: 30000, currency: 'EUR' });
    expect(payment.allocations?.[0]?.amount.amount).toBe(30000);
  });

  it('n’expose ni référence bancaire ni note : le schéma ne les lit pas', async () => {
    const body = clone(paymentPartialDetail);
    Object.assign(body.data, { reference: 'VIR-CONFIDENTIEL', note: 'Note interne', party_id: 'x' });

    const payment = await fetchPayment(clientFor(json(body)).client, REAL_IDS.payment1);

    expect(JSON.stringify(payment)).not.toMatch(/VIR-CONFIDENTIEL|Note interne|party_id/);
  });

  it('refuse un mode de paiement inconnu', async () => {
    const body = clone(paymentPartialDetail);
    Object.assign(body.data, { method: 'crypto' });

    await expect(fetchPayment(clientFor(json(body)).client, REAL_IDS.payment1)).rejects.toBeInstanceOf(UnexpectedResponseError);
  });
});

describe('téléchargement des PDF', () => {
  const pdf = () => new Response('%PDF-1.4 test', { status: 200, headers: { 'Content-Type': 'application/pdf' } });

  it('calcule les chemins d’après les identifiants', () => {
    expect(noticePdfPath(REAL_IDS.installment)).toBe(`/api/v1/tenant/rent/installments/${REAL_IDS.installment}/notice/download`);
    expect(receiptPdfPath(REAL_IDS.receipt)).toBe(`/api/v1/tenant/rent/receipts/${REAL_IDS.receipt}/download`);
    expect(receiptPdfPath('a/b')).toBe('/api/v1/tenant/rent/receipts/a%2Fb/download');
  });

  it('lit le PDF avec la session, sans lien public', async () => {
    const { client, seen, fetchImpl } = clientFor(pdf);

    const blob = await fetchPdf(client, receiptPdfPath(REAL_IDS.receipt), fetchImpl);

    expect(await blob.text()).toBe('%PDF-1.4 test');
    expect(seen[0]?.url.origin).toBe('http://api.test');
    expect(seen[0]?.init?.credentials).toBe('include');
    expect(new Headers(seen[0]?.init?.headers).get('Accept')).toBe('application/pdf');
  });

  it('traduit le 409 d’une quittance annulée en message dédié', async () => {
    const { client, fetchImpl } = clientFor(json(receiptVoidProblem, 409));

    const error = await fetchPdf(client, receiptPdfPath(REAL_IDS.receipt), fetchImpl).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(describeFailure(error)).toEqual({ kind: 'receiptVoid', message: 'Cette quittance a été annulée : son PDF n’est plus délivré.' });
  });

  it('refuse une réponse qui n’est pas un PDF', async () => {
    const { client, fetchImpl } = clientFor(() => new Response('<html></html>', { status: 200, headers: { 'Content-Type': 'text/html' } }));

    await expect(fetchPdf(client, receiptPdfPath(REAL_IDS.receipt), fetchImpl)).rejects.toBeInstanceOf(UnexpectedResponseError);
  });

  it('signale un serveur injoignable', async () => {
    const client = createApiClient({ baseUrl: 'http://api.test', readCookie: () => 'xsrf' });
    const failing = vi.fn<typeof fetch>(() => Promise.reject(new TypeError('Failed to fetch')));

    await expect(fetchPdf(client, receiptPdfPath(REAL_IDS.receipt), failing)).rejects.toBeInstanceOf(ApiUnreachableError);
  });
});
