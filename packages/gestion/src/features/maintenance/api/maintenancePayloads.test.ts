import { describe, expect, it } from 'vitest';
import type { QuoteInput, SupplierInvoiceInput } from '../model';
import { MaintenanceApiError } from './maintenanceErrors';
import {
  allocationPayload,
  checkHeaderKey,
  completePayload,
  createPayload,
  decisionPayload,
  engagePayload,
  filePayload,
  quotePayload,
  supplierInvoicePayload,
  supplierPaymentPayload,
  supplierPayload,
  visitPayload,
} from './maintenancePayloads';

const TODAY = '2026-11-16';
const rejects = (run: () => unknown, message: RegExp) => {
  expect(run).toThrow(MaintenanceApiError);
  expect(run).toThrow(message);
};

const quote = (overrides: Partial<QuoteInput> = {}): QuoteInput => ({
  reference: 'DEV-1',
  kind: 'initial',
  issuedOn: '2026-11-10',
  validUntil: '',
  proposedOn: '',
  message: '',
  fileId: 'file-1',
  currency: 'EUR',
  lines: [{ label: 'Siphon', quantity: '1,5', unitPrice: '120,50', unit: 'u', taxRateKey: 'fr_vat_normal' }],
  ...overrides,
});

describe('montants et quantités', () => {
  it('convertit les lignes de devis en entiers bruts', () => {
    expect(quotePayload(quote(), TODAY)).toMatchObject({ lines: [{ quantity_milli: 1500, unit_price: 12050, tax_rate_key: 'fr_vat_normal', unit: 'u' }], valid_until: null, message: null });
  });

  it('refuse un prix flottant mal formé, une quantité nulle et un taux absent', () => {
    rejects(() => quotePayload(quote({ lines: [{ label: 'a', quantity: '1', unitPrice: '12,505', unit: '', taxRateKey: 'x' }] }), TODAY), /prix unitaire/);
    rejects(() => quotePayload(quote({ lines: [{ label: 'a', quantity: '0', unitPrice: '1', unit: '', taxRateKey: 'x' }] }), TODAY), /quantité/);
    rejects(() => quotePayload(quote({ lines: [{ label: 'a', quantity: '1', unitPrice: '1', unit: '', taxRateKey: '' }] }), TODAY), /taux de taxe/);
    rejects(() => quotePayload(quote({ lines: [] }), TODAY), /entre 1 et 100 lignes/);
  });

  it('refuse un devis sans pièce ou émis dans le futur', () => {
    rejects(() => quotePayload(quote({ fileId: '' }), TODAY), /document justificatif/);
    rejects(() => quotePayload(quote({ issuedOn: '2026-12-01' }), TODAY), /futur/);
    rejects(() => quotePayload(quote({ validUntil: '2026-11-01' }), TODAY), /précéder/);
  });

  it('respecte les devises sans décimale', () => {
    const payload = supplierPaymentPayload({ idempotencyKey: 'cle-reglement', amount: '45000', currency: 'XOF', method: 'cash', paidOn: TODAY, reference: '' }, TODAY);
    expect(payload).toMatchObject({ amount: 45000, method: 'cash', reference: null });
    rejects(() => supplierPaymentPayload({ idempotencyKey: 'cle-reglement', amount: '450,5', currency: 'XOF', method: 'cash', paidOn: TODAY, reference: '' }, TODAY), /montant/i);
  });
});

describe('facture prestataire', () => {
  const invoice = (overrides: Partial<SupplierInvoiceInput> = {}): SupplierInvoiceInput => ({
    idempotencyKey: 'cle-facture-1',
    number: 'F-1',
    invoiceOn: '2026-11-10',
    dueOn: '',
    fileId: 'file-2',
    currency: 'EUR',
    taxes: [{ taxRateKey: 'fr_vat_normal', base: '400', tax: '80' }],
    ...overrides,
  });

  it('envoie la clé d’idempotence dans le corps et les taxes en entiers', () => {
    expect(supplierInvoicePayload(invoice(), TODAY)).toMatchObject({ idempotency_key: 'cle-facture-1', taxes: [{ tax_rate_key: 'fr_vat_normal', base: 40000, tax: 8000 }] });
  });

  it('refuse une clé trop courte, une échéance antérieure et une pièce absente', () => {
    rejects(() => supplierInvoicePayload(invoice({ idempotencyKey: 'court' }), TODAY), /clé de saisie/);
    rejects(() => supplierInvoicePayload(invoice({ dueOn: '2026-11-01' }), TODAY), /échéance/i);
    rejects(() => supplierInvoicePayload(invoice({ fileId: '' }), TODAY), /document justificatif/);
  });
});

describe('autres écritures', () => {
  it('exige le motif d’urgence pour un engagement en urgence', () => {
    rejects(() => engagePayload({ lockVersion: 3, basis: 'emergency', reason: ' ' }), /motif de l’urgence/);
    expect(engagePayload({ lockVersion: 3, basis: 'emergency', reason: 'Dégât des eaux' })).toEqual({ lock_version: 3, basis: 'emergency', reason: 'Dégât des eaux' });
    expect(engagePayload({ lockVersion: 3, basis: 'under_ceiling', reason: '' })).toEqual({ lock_version: 3, basis: 'under_ceiling', reason: null });
  });

  it('exige la pièce écrite pour la décision du mandant', () => {
    rejects(() => decisionPayload({ decision: 'accept', comment: '', proofFileId: null }), /pièce écrite/);
    expect(decisionPayload({ decision: 'refuse', comment: ' non ', proofFileId: 'p1' })).toEqual({ decision: 'refuse', comment: 'non', proof_file_id: 'p1' });
  });

  it('convertit la vétusté en points de base', () => {
    const base = { idempotencyKey: 'cle-imputation', target: 'deposit', shareAmount: '100', currency: 'EUR', basisNote: '' } as const;
    expect(allocationPayload({ ...base, wearPercent: '12,5' })).toMatchObject({ wear_basis_points: 1250, share_amount: 10000, target: 'deposit' });
    expect(allocationPayload({ ...base, wearPercent: '' })).toMatchObject({ wear_basis_points: null });
    rejects(() => allocationPayload({ ...base, wearPercent: '120' }), /vétusté/);
  });

  it('valide la date de fin, la visite et la création', () => {
    rejects(() => completePayload({ lockVersion: 1, completedOn: '2026-12-01', note: 'Terminé' }, TODAY), /futur/);
    rejects(() => visitPayload({ scheduledOn: '2026-11-01', slot: 'morning', presenceRequired: false, contactName: '', contactPhone: '' }, TODAY), /passée/);
    rejects(() => visitPayload({ scheduledOn: '2026-11-20', slot: 'morning', presenceRequired: false, contactName: '', contactPhone: 'abc' }, TODAY), /téléphone/);
    rejects(() => createPayload({ idempotencyKey: 'cle-creation-1', unitId: '', natureTermId: 'n', title: 'Fuite', description: 'Siphon', room: '', availability: '', priority: 'normal' }), /lot/);
    expect(createPayload({ idempotencyKey: 'cle-creation-1', unitId: 'u', natureTermId: 'n', title: ' Fuite ', description: 'Siphon', room: '', availability: '', priority: 'urgent' })).toMatchObject({ title: 'Fuite', room: null, priority: 'urgent' });
  });

  it('valide la clé d’en-tête et la taille des pièces', () => {
    expect(checkHeaderKey('abcdefgh')).toBe('abcdefgh');
    rejects(() => checkHeaderKey('a b'), /clé de saisie/);
    const big = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'gros.pdf', { type: 'application/pdf' });
    rejects(() => filePayload({ file: big, kind: 'quote', visibleToOwner: false, visibleToTenant: false }), /10 Mo/);
    const body = filePayload({ file: new File(['x'], 'a.pdf', { type: 'application/pdf' }), kind: 'quote', visibleToOwner: true, visibleToTenant: false });
    expect(body.get('kind')).toBe('quote');
    expect(body.get('visible_to_owner')).toBe('1');
  });

  it('valide le prestataire', () => {
    rejects(() => supplierPayload({ partyId: '', supplierId: null, tradeTermIds: [], preferred: false, paymentTermsDays: '', internalNote: '' }), /Choisissez/);
    rejects(() => supplierPayload({ partyId: 'p', supplierId: null, tradeTermIds: [], preferred: false, paymentTermsDays: '400', internalNote: '' }), /0 et 365/);
    expect(supplierPayload({ partyId: null, supplierId: 's', tradeTermIds: ['t'], preferred: true, paymentTermsDays: '30', internalNote: '' })).toEqual({ trade_term_ids: ['t'], preferred: true, payment_terms_days: 30, internal_note: null });
  });
});
