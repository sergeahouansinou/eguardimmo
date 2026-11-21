import { describe, expect, it } from 'vitest';
import { RecoveryApiError } from './recoveryErrors';
import { toAct, toBundle, toCase, toCaseSummary, toMoney, toTransmission, toUnpaid } from './recoveryMapping';
import { apiActSchema, apiBundleSchema, apiCaseSchema, apiCaseSummarySchema, apiTransmissionSchema, apiUnpaidSchema } from './recoverySchemas';
import * as api from './responses.fixtures';

const eur = (amount: number) => ({ amount, currency: 'EUR' });

describe('toMoney', () => {
  it('garde les unités mineures et la devise sans conversion', () => {
    expect(toMoney({ amount: 45000, currency: 'EUR' })).toEqual(eur(45000));
    expect(toMoney({ amount: 450000, currency: 'XOF' })).toEqual({ amount: 450000, currency: 'XOF' });
  });

  it('refuse une devise que les écrans ne savent pas afficher', () => {
    expect(() => toMoney({ amount: 100, currency: 'USD' })).toThrow(RecoveryApiError);
  });
});

describe('toUnpaid', () => {
  const [partial, issued] = api.unpaidPage1.data.map((row) => toUnpaid(apiUnpaidSchema.parse(row)));

  it('reprend montants, ancienneté et locataire de la ligne', () => {
    expect(partial).toMatchObject({
      type: 'installment',
      itemId: api.IDS.installments[0],
      reference: null,
      issuedOn: null,
      leaseId: api.IDS.lease,
      partyId: api.IDS.party,
      partyName: 'Célina Barre',
      periodStart: '2026-09-01',
      periodEnd: '2026-09-30',
      dueDate: '2026-09-05',
      daysOverdue: 72,
      status: 'partially_paid',
      total: eur(70000),
      outstanding: eur(45000),
    });
    expect(issued?.outstanding).toEqual(eur(70000));
  });

  it('lit une facture : numéro, date d’émission, pas de période ni de statut d’échéance', () => {
    const invoice = toUnpaid(apiUnpaidSchema.parse(api.unpaidInvoiceOnly.data[0]));
    expect(invoice).toMatchObject({ type: 'invoice', itemId: api.IDS.invoice, reference: 'FA-2026-0001', periodStart: null, periodEnd: null, issuedOn: '2026-10-01', status: null, dueDate: '2026-10-15', total: eur(12000), outstanding: eur(10000) });
  });

  it('expose le dossier qui porte déjà la créance', () => {
    expect(partial?.caseRef).toEqual({ id: api.IDS.case, number: 'RC-2026-0001' });
  });

  it('accepte une créance sans locataire connu', () => {
    const orphan = toUnpaid(apiUnpaidSchema.parse({ ...api.unpaidPage1.data[0], party: null, case: null }));
    expect(orphan).toMatchObject({ partyId: null, partyName: null, caseRef: null });
  });
});

describe('toCase', () => {
  const detail = toCase(apiCaseSchema.parse(api.caseDetail.data));

  it('reprend le résumé du dossier', () => {
    expect(detail).toMatchObject({
      id: api.IDS.case,
      number: 'RC-2026-0001',
      status: 'open',
      leaseId: api.IDS.lease,
      debtorId: api.IDS.party,
      debtorName: 'Célina Barre',
      currency: 'EUR',
      itemsCount: 2,
      outstanding: eur(115000),
    });
  });

  it('distingue les créances actives et la créance retirée, avec montants propres à chacune', () => {
    expect(detail.items.map((item) => [item.total.amount, item.amountDueAtInclusion.amount, item.outstanding?.amount ?? null, item.removedAt === null])).toEqual([
      [70000, 45000, 45000, true],
      [70000, 70000, 70000, true],
      [70000, 70000, null, false],
    ]);
  });

  it('lit une facture du dossier avec son numéro et ses montants propres', () => {
    const withInvoice = toCase(apiCaseSchema.parse(api.caseWithInvoice.data));
    expect(withInvoice.items.at(-1)).toMatchObject({ type: 'invoice', itemId: api.IDS.invoice, reference: 'FA-2026-0001', issuedOn: '2026-10-01', periodStart: null, total: eur(12000), amountDueAtInclusion: eur(12000), outstanding: eur(10000) });
    expect(withInvoice.items.map((item) => item.type)).toEqual(['installment', 'installment', 'invoice']);
  });

  it('reprend les envois du dossier', () => {
    expect(detail.bundles).toEqual([
      { id: api.IDS.bundle, number: 'EP-2026-0001', generatedOn: '2026-11-16', totalDue: eur(115000), piecesCount: 5, transmissionsCount: 2 },
    ]);
  });

  it('lit un résumé de liste', () => {
    expect(toCaseSummary(apiCaseSummarySchema.parse(api.caseList.data[0])).outstanding).toEqual(eur(115000));
  });
});

describe('toAct', () => {
  it('lit un acte manuel', () => {
    expect(toAct(apiActSchema.parse(api.actCall.data))).toMatchObject({ type: 'call', performedOn: '2026-11-10', note: 'Le locataire promet un virement', reference: null, recipientName: null });
  });

  it('lit le destinataire, le nombre de pièces et l’expiration d’un acte de transmission', () => {
    const transmission = api.actsPage.data.find((act) => act.type === 'transmission');
    expect(toAct(apiActSchema.parse(transmission))).toMatchObject({ recipientName: 'Étude Martin', piecesCount: 5, reference: 'EP-2026-0001' });
  });
});

describe('toBundle et toTransmission', () => {
  const bundle = toBundle(apiBundleSchema.parse(api.bundleShowAfter.data));

  it('fige les totaux avec la devise du décompte', () => {
    expect(bundle.totalDue).toEqual(eur(115000));
    expect(bundle.calledTotal).toEqual(eur(140000));
    expect(bundle.pieces).toHaveLength(5);
    expect(bundle.pieces[0]).toMatchObject({ kind: 'statement', label: 'Décompte des sommes dues', fileName: 'decompte-EP-2026-0001.pdf' });
  });

  it('nomme la pièce facture de l’envoi', () => {
    const withInvoice = toBundle(apiBundleSchema.parse(api.bundleWithInvoice.data));
    expect(withInvoice.pieces.find((piece) => piece.kind === 'invoice')).toMatchObject({ label: 'Facture', number: 'FA-2026-0001', fileName: 'facture-FA-2026-0001.pdf' });
  });

  it('lit l’historique des transmissions sans jeton ni IP', () => {
    expect(bundle.transmissions.map((transmission) => [transmission.state, transmission.replacesId === null])).toEqual([['revoked', false], ['revoked', true]]);
    expect(JSON.stringify(bundle)).not.toContain('token');
    expect(JSON.stringify(bundle)).not.toContain('"ip"');
  });

  it('lit une transmission active', () => {
    const active = toTransmission(apiTransmissionSchema.parse(api.transmit.data));
    expect(active).toMatchObject({ state: 'active', recipientEmail: 'etude@martin-cj.fr', downloadCount: 0, revokedAt: null });
  });
});
