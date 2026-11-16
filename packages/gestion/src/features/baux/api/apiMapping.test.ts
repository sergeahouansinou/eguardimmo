import { describe, expect, it } from 'vitest';
import { leaseSchema } from '../schemas';
import { BauxApiError } from './apiErrors';
import { currentTerms, groupAmount, secondaryAmount, toLease, toLeaseExit, toLeaseRow, toOccupancy, toRegime } from './apiMapping';
import { apiLeaseSchema, apiOccupancyEntrySchema, apiRegimeSchema } from './apiSchemas';
import * as api from './responses.fixtures';

const parsed = (detail: unknown) => apiLeaseSchema.parse(detail);

describe('toLease', () => {
  it('convertit un bail composé en bail d’écran, argent en unités mineures et fin inclusive', () => {
    const lease = toLease(parsed(api.leaseDetail));

    expect(leaseSchema.parse(lease)).toEqual(lease);
    expect(lease).toMatchObject({
      id: api.IDS.lease,
      reference: 'BL-2026-0001',
      unitId: api.IDS.unit,
      tenantIds: [api.IDS.tenant],
      furnished: false,
      durationMonths: 36,
      legalNote: 'Logement vide (loi du 6 juillet 1989)',
      start: '2026-01-01',
      end: '2028-12-31',
      rent: 85000,
      charges: 6000,
      deposit: 85000,
      dueDay: 5,
      paymentMethod: 'virement',
      revisionIndex: 'IRL',
      rentControl: 'Encadrement des loyers applicable',
      guarantor: 'Marc Chevalier',
      tacitNote: 'Reconduction tacite',
      status: 'en_cours',
      note: 'Clés remises',
      archived: false,
    });
    expect([lease.rent, lease.charges, lease.deposit].every(Number.isInteger)).toBe(true);
  });

  it.each([
    ['draft', 'brouillon'],
    ['upcoming', 'a_venir'],
    ['running', 'en_cours'],
    ['notice', 'preavis'],
    ['ended', 'termine'],
  ])('traduit la phase %s en état %s', (phase, status) => {
    expect(toLease(parsed({ ...api.leaseDetail, phase })).status).toBe(status);
  });

  it.each([
    ['transfer', 'virement'],
    ['direct_debit', 'prelevement'],
    ['card', 'carte'],
    ['cheque', 'cheque'],
    ['cash', 'especes'],
  ])('traduit le mode de paiement %s en %s', (method, expected) => {
    expect(toLease(parsed({ ...api.leaseDetail, payment_method: method })).paymentMethod).toBe(expected);
  });

  it('reconnaît le meublé, le bail archivé et l’absence de garant', () => {
    const lease = toLease(parsed({ ...api.leaseDetail, regime_key: 'fr.residential.furnished', archived_at: '2026-06-01T10:00:00+00:00', parties: api.leaseDetail.parties.slice(0, 1), note: null }));
    expect(lease).toMatchObject({ furnished: true, archived: true, guarantor: null, note: '' });
  });

  it('refuse un bail sans terme plutôt que d’inventer une date de fin', () => {
    expect(() => toLease(parsed({ ...api.leaseDetail, end_date: null, duration_months: null }))).toThrow(BauxApiError);
  });

  it('refuse une devise autre que l’euro', () => {
    expect(() => toLease(parsed({ ...api.leaseDetail, currency: 'XOF' }))).toThrow('en euros');
  });

  it('ne garde aucun solde ni dépôt reçu inventés', () => {
    expect(toLease(parsed(api.leaseDetail), TODAY)).toMatchObject({ balance: 0, depositReceivedOn: null });
  });
});

const TODAY = '2026-11-16';

describe('prochaine révision', () => {
  it('tombe à la prochaine date anniversaire quand le loyer en vigueur est indexé', () => {
    expect(toLease(parsed(api.leaseDetail), TODAY).nextRevision).toBe('2027-01-01');
    expect(toLease(parsed(api.leaseDetail), '2027-01-01').nextRevision).toBe('2028-01-01');
  });

  it('reste vide quand le loyer n’est pas indexé : rien n’est à réviser', () => {
    const rent = { ...api.rentTerm, indexed: false };
    expect(toLease(parsed({ ...api.leaseDetail, terms: [rent, api.chargesTerm, api.depositTerm] }), TODAY).nextRevision).toBeNull();
  });

  it('reste vide pour un brouillon, un bail terminé ou une date anniversaire postérieure au terme', () => {
    expect(toLease(parsed({ ...api.leaseDetail, phase: 'draft' }), TODAY).nextRevision).toBeNull();
    expect(toLease(parsed({ ...api.leaseDetail, phase: 'ended' }), TODAY).nextRevision).toBeNull();
    expect(toLease(parsed({ ...api.leaseDetail, end_date: '2026-12-31' }), TODAY).nextRevision).toBeNull();
  });
});

describe('toLeaseRow', () => {
  it('garde un bail affichable tel quel', () => {
    expect(toLeaseRow(parsed(api.leaseDetail), TODAY)).toEqual(toLease(parsed(api.leaseDetail), TODAY));
  });

  it('transforme un bail sans terme en ligne non affichable, sans montant ni date de fin inventés', () => {
    const row = toLeaseRow(parsed({ ...api.leaseDetail, end_date: null, duration_months: null }), TODAY);
    expect(leaseSchema.parse(row)).toEqual(row);
    expect(row).toMatchObject({ reference: 'BL-2026-0001', rent: 0, charges: 0, deposit: 0, nextRevision: null, status: 'en_cours' });
    expect(row.unsupported).toContain('pas de terme');
  });

  it('transforme une autre devise en ligne non affichable', () => {
    expect(toLeaseRow(parsed({ ...api.leaseDetail, currency: 'XOF' }), TODAY).unsupported).toContain('euros');
  });

  it('laisse remonter une réponse incohérente au lieu de la masquer', () => {
    expect(() => toLeaseRow(parsed({ ...api.leaseDetail, main_unit: null, units: [] }), TODAY)).toThrow(BauxApiError);
  });
});

describe('composantes du loyer', () => {
  const supplement = { ...api.rentTerm, id: '01935a60-0000-7000-8000-0000000000aa', component: { ...api.rentComponent, id: api.IDS.supplementComponent, key: 'rent_supplement', semantic_key: 'rent_supplement' }, amount: { amount: 5000, currency: 'EUR' } };
  const terms = parsed({ ...api.leaseDetail, terms: [api.rentTerm, supplement, api.chargesTerm] }).terms;

  it('additionne le loyer et son complément', () => {
    expect(groupAmount(terms, 'rent')).toBe(90000);
    expect(secondaryAmount(terms, 'rent')).toBe(5000);
  });

  it('retient la dernière période connue quand aucune ligne n’est en vigueur', () => {
    const old = { ...api.rentTerm, in_force: false, end_date: '2026-06-30' };
    const recent = { ...api.rentTerm, id: '01935a60-0000-7000-8000-0000000000bb', in_force: false, valid_from: '2026-07-01', end_date: '2026-12-31', amount: { amount: 88000, currency: 'EUR' } };
    const ended = parsed({ ...api.leaseDetail, terms: [old, recent] }).terms;
    expect(currentTerms(ended, 'rent')).toHaveLength(1);
    expect(groupAmount(ended, 'rent')).toBe(88000);
  });

  it('privilégie les lignes en vigueur sur l’historique', () => {
    const history = { ...api.rentTerm, id: '01935a60-0000-7000-8000-0000000000cc', in_force: false, end_date: '2025-12-31', amount: { amount: 80000, currency: 'EUR' } };
    expect(groupAmount(parsed({ ...api.leaseDetail, terms: [history, api.rentTerm] }).terms, 'rent')).toBe(85000);
  });
});

describe('toLeaseExit', () => {
  it('construit le suivi de sortie depuis le préavis, sans étapes inventées', () => {
    const exit = toLeaseExit(parsed(api.noticeDetail));
    expect(exit).toMatchObject({
      leaseId: api.IDS.leaseNotice,
      noticeReceivedOn: '2026-10-01',
      noticeKind: 'Préavis du locataire',
      departure: '2026-11-30',
      lastInstallment: '2026-11',
      reason: 'Mutation professionnelle',
      steps: [],
      repairs: [],
      unpaid: 0,
      depositReturned: false,
      attestationId: null,
    });
  });

  it('ne renvoie rien sans préavis', () => {
    expect(toLeaseExit(parsed(api.leaseDetail))).toBeNull();
  });

  it('distingue le congé du bailleur', () => {
    const detail = { ...api.noticeDetail, notice: { ...api.noticeDetail.notice, given_by: 'landlord' } };
    expect(toLeaseExit(parsed(detail))?.noticeKind).toBe('Congé du bailleur');
  });
});

describe('régimes et occupation', () => {
  it('convertit un régime', () => {
    const regime = toRegime(apiRegimeSchema.parse(api.regimesResponse.data[1]));
    expect(regime).toMatchObject({ key: 'fr.residential.unfurnished', jurisdiction: 'FR', defaultDurationMonths: 36, depositCapMonths: 1, tenantNoticeMonths: 3, landlordNoticeMonths: 6, maximumDurationMonths: null });
  });

  it('convertit une occupation occupée puis vacante', () => {
    const [busy, vacant] = api.occupancyResponse.data.map((entry) => toOccupancy(apiOccupancyEntrySchema.parse(entry)));
    expect(busy).toMatchObject({ unitId: api.IDS.unit, propertyName: 'Résidence du Port', vacant: false, since: '2026-01-01', lease: { reference: 'BL-2026-0001', status: 'en_cours', end: '2028-12-31', tenants: [{ id: api.IDS.tenant, name: 'Awa Diallo' }] } });
    expect(vacant).toMatchObject({ vacant: true, lease: null });
  });
});
