import { describe, expect, it } from 'vitest';
import { toInvoice, toItemTerm, toMoney, toRecipients } from './invoicingMapping';
import * as api from './responses.fixtures';
import { apiInvoiceSchema, apiItemTerms, apiPartyPage } from './invoicingSchemas';

const parse = (data: unknown) => apiInvoiceSchema.parse(data);

describe('toMoney', () => {
  it('refuse une devise que les écrans ne savent pas afficher', () => {
    expect(() => toMoney({ amount: 100, currency: 'GBP' })).toThrow(/GBP/);
    expect(toMoney({ amount: 100, currency: 'XOF' })).toEqual({ amount: 100, currency: 'XOF' });
  });
});

describe('toInvoice', () => {
  const today = '2026-11-16';

  it('lit une facture émise avec ses lignes, ses taxes en cent-millièmes et ses règlements', () => {
    const invoice = toInvoice(parse(api.partialDetail.data), today);
    expect(invoice).toMatchObject({
      kind: 'invoice',
      status: 'partially_paid',
      number: 'FA-2026-0002',
      totalNet: { amount: 10000, currency: 'EUR' },
      totalTax: { amount: 2000, currency: 'EUR' },
      totalGross: { amount: 12000, currency: 'EUR' },
      outstanding: { amount: 7000, currency: 'EUR' },
      isOverdue: false,
    });
    expect(invoice.lines?.[0]).toMatchObject({ quantityMilli: 1000, unitPrice: { amount: 10000, currency: 'EUR' }, taxCategory: 'S', taxRatePcm: 20000 });
    expect(invoice.taxes?.[0]).toMatchObject({ taxCode: 'vat', ratePcm: 20000, base: { amount: 10000, currency: 'EUR' }, amount: { amount: 2000, currency: 'EUR' } });
    expect(invoice.payments?.[0]).toMatchObject({ amount: { amount: 5000, currency: 'EUR' }, method: 'transfer', cancelledAt: null });
  });

  it('calcule le retard à partir de l’échéance et du reste dû, jamais pour un avoir ni une facture soldée', () => {
    expect(toInvoice(parse(api.overdueDetail.data), today).isOverdue).toBe(true);
    expect(toInvoice(parse(api.overdueDetail.data), '2026-11-05').isOverdue).toBe(false);
    expect(toInvoice(parse({ ...api.overdueDetail.data, outstanding: { amount: 0, currency: 'EUR' } }), today).isOverdue).toBe(false);
    expect(toInvoice(parse({ ...api.overdueDetail.data, outstanding: null }), today).isOverdue).toBe(false);
    expect(toInvoice(parse({ ...api.overdueDetail.data, kind: 'credit_note' }), today).isOverdue).toBe(false);
  });

  it('garde les relations absentes d’une ligne de liste à null', () => {
    const row = toInvoice(parse(api.invoicesPage.data[0]), today);
    expect(row).toMatchObject({ status: 'draft', number: null, outstanding: null, lines: null, taxes: null, payments: null });
  });

  it('lit un avoir : numéro AF, facture d’origine et motif', () => {
    expect(toInvoice(parse(api.creditNoteDetail.data), today)).toMatchObject({ kind: 'credit_note', number: 'AF-2026-0001', creditedInvoiceId: api.IDS.issued, creditReason: 'Remise commerciale', replayed: false });
  });

  it('refuse une réponse dont la forme change', () => {
    expect(apiInvoiceSchema.safeParse({ ...api.issuedDetail.data, status: 'inconnu' }).success).toBe(false);
    expect(apiInvoiceSchema.safeParse({ ...api.issuedDetail.data, total_gross: { amount: 120.5, currency: 'EUR' } }).success).toBe(false);
    expect(apiInvoiceSchema.safeParse({ ...api.issuedDetail.data, id: 'pas-un-guid' }).success).toBe(false);
  });
});

describe('référentiels', () => {
  it('lit les parties avec leur état', () => {
    expect(toRecipients(apiPartyPage.parse(api.partiesPage).data)).toEqual([
      { id: api.IDS.party, name: 'SCI Les Tilleuls', email: 'contact@tilleuls.example.test', anonymized: false, archived: false },
      { id: api.IDS.otherParty, name: 'Danielle Martin', email: null, anonymized: false, archived: false },
    ]);
  });

  it('lit la nature d’une ligne depuis son libellé français', () => {
    const [first] = apiItemTerms.parse(api.itemTerms).data;
    expect(first && toItemTerm(first)).toEqual({ id: api.IDS.term, label: 'Honoraires de gestion', semantic: 'fee.management' });
    expect(toItemTerm({ id: 'x', labels: {}, key: 'cle', semantic_key: null })).toEqual({ id: 'x', label: 'cle', semantic: null });
  });
});
