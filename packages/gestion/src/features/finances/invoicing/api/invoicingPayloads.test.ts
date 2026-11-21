import { describe, expect, it } from 'vitest';
import type { CreditNoteInput, DraftInput, PaymentInput } from '../model';
import { InvoicingApiError } from './invoicingErrors';
import { creditNotePayload, draftPayload, paymentPayload } from './invoicingPayloads';

const draft = (overrides: Partial<DraftInput> = {}): DraftInput => ({
  invoiceId: null,
  lockVersion: null,
  idempotencyKey: 'brouillon-cle-1',
  recipientPartyId: '01a1ee5a-0bb7-73fa-a273-ea6cbd9aa602',
  leaseId: null,
  mandateId: null,
  currency: 'EUR',
  dueOn: '',
  serviceFrom: '2026-11-01',
  serviceTo: '2026-11-30',
  lines: [{ itemTermId: '01a1ee5a-0bb7-73fa-a273-ea6cbd9aa630', description: ' Honoraires ', quantity: '2,5', unitPrice: '100,50', taxCategory: 'S' }],
  ...overrides,
});

const rejects = (run: () => unknown, message: RegExp | string) => {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(InvoicingApiError);
    expect((error as InvoicingApiError).kind).toBe('invalid');
    expect((error as InvoicingApiError).message).toMatch(message);
    return;
  }
  throw new Error('Une erreur de validation était attendue');
};

describe('payload d’un brouillon', () => {
  it('convertit quantité en millièmes et prix en unités mineures, sans jamais envoyer taux ni total', () => {
    const body = draftPayload(draft());
    expect(body).toEqual({
      recipient_party_id: '01a1ee5a-0bb7-73fa-a273-ea6cbd9aa602',
      lease_id: null,
      mandate_id: null,
      due_on: null,
      service_from: '2026-11-01',
      service_to: '2026-11-30',
      lines: [{ item_term_id: '01a1ee5a-0bb7-73fa-a273-ea6cbd9aa630', description: 'Honoraires', quantity_milli: 2500, unit_price: 10050, tax_category: 'S' }],
      idempotency_key: 'brouillon-cle-1',
    });
    expect(Object.keys(body)).not.toEqual(expect.arrayContaining(['total_net', 'tax_rate_pcm', 'currency', 'number', 'status', 'issued_on']));
  });

  it('n’admet pas de décimale pour une devise sans décimales', () => {
    expect(draftPayload(draft({ currency: 'XOF', lines: [{ itemTermId: 't', description: 'x', quantity: '1', unitPrice: '45000', taxCategory: 'Z' }] })).lines).toEqual([
      { item_term_id: 't', description: 'x', quantity_milli: 1000, unit_price: 45000, tax_category: 'Z' },
    ]);
    rejects(() => draftPayload(draft({ currency: 'XOF', lines: [{ itemTermId: 't', description: 'x', quantity: '1', unitPrice: '450,5', taxCategory: 'Z' }] })), /prix unitaire/);
  });

  it('modifie un brouillon avec sa version et sans clé d’idempotence', () => {
    const body = draftPayload(draft({ invoiceId: 'b', lockVersion: 3, idempotencyKey: null, dueOn: '2026-12-16' }));
    expect(body).toMatchObject({ lock_version: 3, due_on: '2026-12-16' });
    expect(body).not.toHaveProperty('idempotency_key');
  });

  it.each([
    [{ recipientPartyId: '' }, /destinataire/],
    [{ lines: [] }, /entre 1 et 100 lignes/],
    [{ idempotencyKey: 'court' }, /clé de saisie/],
    [{ idempotencyKey: null }, /clé de saisie/],
    [{ serviceFrom: '2026-11-30', serviceTo: '2026-11-01' }, /fin de la période/],
    [{ dueOn: '2026-13-45' }, /échéance/i],
    [{ lines: [{ itemTermId: '', description: 'x', quantity: '1', unitPrice: '1', taxCategory: 'S' as const }] }, /Ligne 1 : choisissez la nature/],
    [{ lines: [{ itemTermId: 't', description: '  ', quantity: '1', unitPrice: '1', taxCategory: 'S' as const }] }, /Ligne 1 : le libellé/],
    [{ lines: [{ itemTermId: 't', description: 'x', quantity: '0', unitPrice: '1', taxCategory: 'S' as const }] }, /Ligne 1 : indiquez une quantité/],
    [{ lines: [{ itemTermId: 't', description: 'x', quantity: '1,0001', unitPrice: '1', taxCategory: 'S' as const }] }, /Ligne 1 : indiquez une quantité/],
    [{ lines: [{ itemTermId: 't', description: 'x', quantity: '1', unitPrice: '-3', taxCategory: 'S' as const }] }, /Ligne 1 : indiquez un prix/],
  ] satisfies [Partial<DraftInput>, RegExp][])('refuse un brouillon invalide avant tout appel réseau (%#)', (overrides, message) => {
    rejects(() => draftPayload(draft(overrides)), message);
  });

  it('refuse une modification sans version connue', () => {
    rejects(() => draftPayload(draft({ invoiceId: 'b', lockVersion: null, idempotencyKey: null })), /version/);
  });
});

const payment = (overrides: Partial<PaymentInput> = {}): PaymentInput => ({ amount: '50', currency: 'EUR', method: 'transfer', paidOn: '2026-11-16', reference: ' VIR-1 ', idempotencyKey: 'reglement-cle-1', ...overrides });

describe('payload d’un règlement', () => {
  it('envoie le montant en unités mineures, sans devise', () => {
    expect(paymentPayload(payment(), '2026-11-16')).toEqual({ amount: 5000, method: 'transfer', paid_on: '2026-11-16', reference: 'VIR-1', idempotency_key: 'reglement-cle-1' });
    expect(paymentPayload(payment({ reference: '' }), '2026-11-16')).toMatchObject({ reference: null });
  });

  it.each([
    [{ amount: '0' }, /strictement positif/],
    [{ amount: 'abc' }, /strictement positif/],
    [{ paidOn: '2026-11-17' }, /futur/],
    [{ paidOn: '' }, /date du règlement/],
    [{ reference: 'x'.repeat(121) }, /120 caractères/],
    [{ idempotencyKey: 'a b' }, /clé de saisie/],
  ] satisfies [Partial<PaymentInput>, RegExp][])('refuse un règlement invalide (%#)', (overrides, message) => {
    rejects(() => paymentPayload(payment(overrides), '2026-11-16'), message);
  });
});

const credit = (overrides: Partial<CreditNoteInput> = {}): CreditNoteInput => ({ reason: ' Remise ', full: true, lines: [], idempotencyKey: 'avoir-cle-0001', ...overrides });

describe('payload d’un avoir', () => {
  it('envoie un avoir total sans ligne ni montant', () => {
    expect(creditNotePayload(credit({ lines: [{ lineId: 'x', quantity: '1' }] }))).toEqual({ reason: 'Remise', full: true, idempotency_key: 'avoir-cle-0001' });
  });

  it('envoie un avoir partiel avec les seules lignes saisies, en millièmes', () => {
    expect(creditNotePayload(credit({ full: false, lines: [{ lineId: 'a', quantity: '0,5' }, { lineId: 'b', quantity: '' }] }))).toEqual({
      reason: 'Remise',
      full: false,
      lines: [{ line_id: 'a', quantity_milli: 500 }],
      idempotency_key: 'avoir-cle-0001',
    });
  });

  it.each([
    [{ reason: 'x' }, /motif/],
    [{ reason: 'x'.repeat(256) }, /motif/],
    [{ full: false, lines: [{ lineId: 'a', quantity: '' }] }, /au moins une ligne/],
    [{ full: false, lines: [{ lineId: 'a', quantity: '-1' }] }, /quantité à créditer/],
    [{ idempotencyKey: 'court' }, /clé de saisie/],
  ] satisfies [Partial<CreditNoteInput>, RegExp][])('refuse un avoir invalide (%#)', (overrides, message) => {
    rejects(() => creditNotePayload(credit(overrides)), message);
  });
});
