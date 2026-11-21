import { describe, expect, it } from 'vitest';
import { RentApiError } from './rentErrors';
import { toBalance, toInstallment, toMoney, toPayment, toReceipt } from './rentMapping';
import { apiBalanceSchema, apiInstallmentSchema, apiPaymentSchema, apiReceiptSchema } from './rentSchemas';
import * as api from './responses.fixtures';

const eur = (amount: number) => ({ amount, currency: 'EUR' });

describe('toMoney', () => {
  it('garde les unités mineures et la devise sans conversion', () => {
    expect(toMoney({ amount: 65000, currency: 'EUR' })).toEqual({ amount: 65000, currency: 'EUR' });
    expect(toMoney({ amount: 450000, currency: 'XOF' })).toEqual({ amount: 450000, currency: 'XOF' });
  });

  it('refuse une devise que les écrans ne savent pas afficher', () => {
    expect(() => toMoney({ amount: 100, currency: 'USD' })).toThrow(RentApiError);
    expect(() => toMoney({ amount: 100, currency: 'USD' })).toThrow('La devise USD n’est pas prise en charge');
  });
});

describe('toInstallment', () => {
  const paid = toInstallment(apiInstallmentSchema.parse(api.paidDetail.data));

  it('reprend chaque montant de sa propre composante', () => {
    expect(paid.rent).toEqual(eur(65000));
    expect(paid.charges).toEqual(eur(5000));
    expect(paid.vat).toEqual(eur(0));
    expect(paid.total).toEqual(eur(70000));
    expect(paid.outstanding).toEqual(eur(0));
  });

  it('reprend les dates, le statut, l’avis et la quittance', () => {
    expect(paid).toMatchObject({
      leaseId: api.IDS.lease,
      leaseReference: api.paidDetail.data.lease.reference,
      periodStart: '2026-11-01',
      periodEnd: '2026-11-30',
      dueDate: '2026-11-05',
      status: 'paid',
      isOverdue: false,
      issuedOn: '2026-11-16',
      receiptState: 'issued',
    });
    expect(paid.notice).toMatchObject({ number: 'AV-2026-0001', issuedOn: '2026-11-16' });
    expect(paid.receipt).toMatchObject({ number: 'QT-2026-0001', issuedOn: '2026-11-16' });
  });

  it('reprend les lignes avec montants mensuels et prorata', () => {
    expect(paid.lines).toHaveLength(2);
    expect(paid.lines?.[0]).toMatchObject({ label: 'Loyer de novembre 2026', componentKey: 'rent', days: 30, monthDays: 30, monthlyAmount: eur(65000), amount: eur(65000), vatBp: 0, vatAmount: eur(0) });
    expect(paid.lines?.[1]).toMatchObject({ componentKey: 'charges_provision', amount: eur(5000) });
  });

  it('garde un reste dû nul distinct d’un reste dû absent', () => {
    const upcoming = toInstallment(apiInstallmentSchema.parse(api.upcomingPage.data[0]));
    expect(upcoming.outstanding).toBeNull();
    expect(upcoming.lines).toBeNull();
    expect(upcoming.notice).toBeNull();
    expect(upcoming.receipt).toBeNull();
    expect(upcoming.receiptState).toBe('not_due');
  });

  it('lit le reste dû d’une échéance partiellement payée en retard', () => {
    const partial = toInstallment(apiInstallmentSchema.parse(api.overduePartialPage.data[0]));
    expect(partial).toMatchObject({ status: 'partially_paid', isOverdue: true, outstanding: eur(30000), total: eur(70000) });
  });

  it('lit une échéance annulée avec son motif', () => {
    expect(toInstallment(apiInstallmentSchema.parse(api.cancelledDetail.data))).toMatchObject({ status: 'cancelled', cancelledOn: '2027-01-10', cancellationReason: 'Erreur de génération', outstanding: null });
  });
});

describe('toPayment', () => {
  it('reprend le montant, les imputations et l’avance', () => {
    const payment = toPayment(apiPaymentSchema.parse(api.paymentPartial.data));
    expect(payment).toMatchObject({ status: 'recorded', method: 'transfer', amount: eur(30000), receivedOn: '2026-11-16', reference: 'VIR-123', note: 'Virement partiel', replayed: false, advance: eur(0), receipts: null });
    expect(payment.allocations).toEqual([{ installmentId: api.IDS.installment, amount: eur(30000) }]);
  });

  it('lit un surplus conservé en avance sans imputation', () => {
    const payment = toPayment(apiPaymentSchema.parse(api.paymentAdvance.data));
    expect(payment).toMatchObject({ method: 'cheque', amount: eur(100000), allocations: [], advance: eur(100000) });
  });

  it('lit l’état des quittances par échéance soldée', () => {
    expect(toPayment(apiPaymentSchema.parse(api.paymentFull.data)).receipts).toEqual({ [api.IDS.installment]: 'issued' });
  });

  it('lit un paiement annulé sans avance ni imputation', () => {
    expect(toPayment(apiPaymentSchema.parse(api.paymentCancelled.data))).toMatchObject({ status: 'cancelled', cancelledOn: '2026-11-16', cancellationReason: 'Chèque rejeté', allocations: [], advance: null });
  });
});

describe('toBalance', () => {
  it('distingue solde, retard et avance', () => {
    expect(toBalance(apiBalanceSchema.parse(api.balanceAdvance.data))).toEqual({
      leaseId: api.IDS.lease,
      balance: eur(-100000),
      overdue: eur(0),
      advance: eur(100000),
      unpaidCount: 0,
      oldestUnpaidDueDate: null,
    });
  });
});

describe('toReceipt', () => {
  const receipt = toReceipt(apiReceiptSchema.parse(api.receiptDetail.data));

  it('reprend les montants et l’identité figée de la quittance', () => {
    expect(receipt).toMatchObject({
      number: 'QT-2026-0001',
      installmentId: api.IDS.installment,
      tenants: ['Danielle Martin'],
      rent: eur(65000),
      charges: eur(5000),
      vat: eur(0),
      total: eur(70000),
      issuedOn: '2026-11-16',
      isVoid: false,
      periodStart: '2026-11-01',
      periodEnd: '2026-11-30',
      dueDate: '2026-11-05',
    });
    expect(receipt.address).toBe('12 rue du Port, 13002 Marseille');
    expect(receipt.unitReference).toBe(api.receiptDetail.data.unit.reference);
  });

  it('convertit l’instantané en montants typés dans sa devise', () => {
    expect(receipt.snapshot?.issuerName).toBe('Agence du Port');
    expect(receipt.snapshot?.lines.map((line) => line.amount)).toEqual([eur(65000), eur(5000)]);
    expect(receipt.snapshot?.payments).toEqual([
      { receivedOn: '2026-11-16', method: 'transfer', amount: eur(30000) },
      { receivedOn: '2026-11-16', method: 'transfer', amount: eur(40000) },
    ]);
    expect(receipt.snapshot?.mention).toContain('article 21 de la loi n° 89-462');
  });

  it('n’a pas d’instantané dans la liste', () => {
    expect(toReceipt(apiReceiptSchema.parse(api.receiptsPage.data[0])).snapshot).toBeNull();
  });
});
