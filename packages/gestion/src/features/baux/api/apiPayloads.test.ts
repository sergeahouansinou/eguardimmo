import { describe, expect, it } from 'vitest';
import { BauxApiError } from './apiErrors';
import {
  addPartyPayload,
  addUnitPayload,
  assertServerIds,
  cancelPayload,
  createPayload,
  draftUpdatePayload,
  draftValues,
  endPartyPayload,
  endUnitPayload,
  noticeParts,
  noticePayload,
  partyLines,
  renewPayload,
  revisePayload,
  signPayload,
  signedUpdatePayload,
  structuralChanges,
  terminatePayload,
  termLines,
  unitLines,
} from './apiPayloads';
import type { ComponentIds } from './apiPayloads';
import { toLease } from './apiMapping';
import { apiLeaseSchema } from './apiSchemas';
import * as api from './responses.fixtures';

const lease = apiLeaseSchema.parse(api.leaseDetail);
const draft = apiLeaseSchema.parse(api.draftDetail);
const ids: ComponentIds = { rent: api.IDS.rentComponent, charges: api.IDS.chargesComponent, deposit: api.IDS.depositComponent };
const regime = { jurisdiction: 'FR', regimeKey: 'fr.residential.unfurnished' };

const input = (overrides: Record<string, unknown> = {}) => ({
  unitId: api.IDS.unit,
  furnished: false,
  start: '2026-02-01',
  durationMonths: '36',
  tenantIds: [api.IDS.tenant],
  paymentMethod: 'virement',
  note: '',
  rent: '850,50',
  charges: '60',
  deposit: '850',
  dueDay: '5',
  asDraft: false,
  ...overrides,
});

describe('draftValues', () => {
  it('convertit les euros saisis en unités mineures entières', () => {
    const values = draftValues(input(), '2026-11-16');
    expect(values).toMatchObject({ rent: 85050, charges: 6000, deposit: 85000, durationMonths: 36, dueDay: 5, start: '2026-02-01' });
  });

  it('complète un brouillon incomplet avec la date du jour et laisse les durées au régime', () => {
    const values = draftValues(input({ asDraft: true, start: '', durationMonths: '', rent: '', charges: '', deposit: '', dueDay: '', tenantIds: [] }), '2026-11-16');
    expect(values).toMatchObject({ start: '2026-11-16', durationMonths: null, rent: null, charges: null, deposit: null, dueDay: 1 });
  });

  it('refuse une saisie invalide avec le schéma du formulaire', () => {
    expect(() => draftValues(input({ rent: 'abc' }), '2026-11-16')).toThrow();
  });
});

describe('assertServerIds', () => {
  it('accepte des identifiants serveur', () => {
    expect(() => { assertServerIds({ unitId: api.IDS.unit, tenantIds: [api.IDS.tenant] }); }).not.toThrow();
  });

  it('refuse un identifiant de démonstration avec une erreur typée', () => {
    expect(() => { assertServerIds({ unitId: 'studio-2e', tenantIds: [api.IDS.tenant] }); }).toThrow(BauxApiError);
  });
});

describe('createPayload', () => {
  it('compose le bail : lot principal, locataires, lignes de loyer indexée et dates', () => {
    const payload = createPayload(draftValues(input(), '2026-11-16'), regime, ids);
    expect(payload).toEqual({
      jurisdiction: 'FR',
      regime_key: 'fr.residential.unfurnished',
      starts_on: '2026-02-01',
      duration_months: 36,
      due_day: 5,
      periodicity: 'monthly',
      billing_timing: 'advance',
      payment_method: 'transfer',
      jurisdiction_data: { revision_index: 'irl' },
      note: null,
      units: [{ unit_id: api.IDS.unit, is_main: true }],
      parties: [{ party_id: api.IDS.tenant, role: 'tenant', joint_liability: false }],
      terms: [
        { component_term_id: api.IDS.rentComponent, amount: 85050, vat_bp: 0, indexed: true },
        { component_term_id: api.IDS.chargesComponent, amount: 6000, vat_bp: 0, indexed: false },
        { component_term_id: api.IDS.depositComponent, amount: 85000, vat_bp: 0, indexed: false },
      ],
    });
  });

  it('n’envoie aucune ligne vide pour un brouillon sans montants', () => {
    const payload = createPayload(draftValues(input({ asDraft: true, rent: '', charges: '0', deposit: '' }), '2026-11-16'), regime, ids);
    expect(payload.terms).toEqual([]);
  });
});

describe('lignes préservées à la modification d’un brouillon', () => {
  it('garde le garant et l’annexe, remplace les locataires et le lot principal', () => {
    const parties = partyLines(draft.parties, [api.IDS.coTenant, api.IDS.tenant]);
    expect(parties).toEqual([
      { party_id: api.IDS.coTenant, role: 'tenant', joint_liability: false },
      { party_id: api.IDS.tenant, role: 'tenant', joint_liability: false },
      { party_id: api.IDS.guarantor, role: 'guarantor', joint_liability: false, guarantees_party_id: api.IDS.tenant, guarantee_limit_amount: 300000, guarantee_ends_on: '2029-01-01' },
    ]);
    expect(unitLines(lease.units, api.IDS.coTenant)).toEqual([
      { unit_id: api.IDS.coTenant, is_main: true },
      { unit_id: api.IDS.annex, is_main: false },
    ]);
  });

  it('conserve le complément de loyer et ajuste la ligne principale au total saisi', () => {
    const supplement = { ...api.rentTerm, id: '01935a60-0000-7000-8000-0000000000aa', component: { ...api.rentComponent, id: api.IDS.supplementComponent, key: 'rent_supplement', semantic_key: 'rent_supplement' }, amount: { amount: 5000, currency: 'EUR' } };
    const existing = apiLeaseSchema.parse({ ...api.leaseDetail, terms: [api.rentTerm, supplement, api.chargesTerm, api.depositTerm] }).terms;
    const lines = termLines(existing, draftValues(input({ rent: '900' }), '2026-11-16'), ids, '2026-01-01');
    expect(lines).toContainEqual({ component_term_id: api.IDS.rentComponent, amount: 85000, vat_bp: 0, indexed: true });
    expect(lines).toContainEqual({ component_term_id: api.IDS.supplementComponent, amount: 5000, vat_bp: 0, indexed: true });
  });

  it('refuse un loyer inférieur au complément déjà porté', () => {
    const supplement = { ...api.rentTerm, id: '01935a60-0000-7000-8000-0000000000aa', component: { ...api.rentComponent, key: 'rent_supplement', semantic_key: 'rent_supplement' }, amount: { amount: 5000, currency: 'EUR' } };
    const existing = apiLeaseSchema.parse({ ...api.leaseDetail, terms: [api.rentTerm, supplement] }).terms;
    expect(() => termLines(existing, draftValues(input({ rent: '30', deposit: '10' }), '2026-11-16'), ids, '2026-01-01')).toThrow(BauxApiError);
  });

  it('propage lock_version dans la mise à jour d’un brouillon', () => {
    const payload = draftUpdatePayload(draft, draftValues(input(), '2026-11-16'), regime, ids);
    expect(payload).toMatchObject({ lock_version: 1, starts_on: '2026-02-01', due_day: 5, payment_method: 'transfer' });
  });

  it('ne touche qu’au mode de paiement et à la note d’un bail signé', () => {
    expect(signedUpdatePayload(lease, draftValues(input({ note: ' Note ', paymentMethod: 'cheque' }), '2026-11-16'))).toEqual({ lock_version: 3, payment_method: 'cheque', note: 'Note' });
  });
});

describe('structuralChanges', () => {
  const current = toLease(lease);
  const same = (overrides: Record<string, unknown> = {}) =>
    draftValues(input({ start: '2026-01-01', rent: '850', charges: '60', deposit: '850', ...overrides }), '2026-11-16');

  it('ne signale rien quand seuls note et paiement changent', () => {
    expect(structuralChanges(current, same({ note: 'Autre note', paymentMethod: 'cheque' }))).toEqual([]);
  });

  it('nomme les conditions modifiées', () => {
    expect(structuralChanges(current, same({ rent: '900', dueDay: '10' }))).toEqual(['le loyer', 'le jour d’échéance']);
  });
});

describe('préavis', () => {
  it('exige un motif d’au moins trois caractères', () => {
    expect(() => noticeParts({ noticeReceivedOn: '2026-10-01', departure: '2026-11-30', reason: ' ab ' })).toThrow('motif');
  });

  it('demande un remplacement explicite quand un préavis existe déjà', () => {
    const parts = noticeParts({ noticeReceivedOn: '2026-10-01', departure: '2026-11-30', reason: 'Mutation professionnelle' });
    expect(noticePayload(lease, parts)).toEqual({ lock_version: 3, notice_given_by: 'tenant', notice_received_on: '2026-10-01', notice_departure_on: '2026-11-30', termination_reason: 'Mutation professionnelle', replace: false });
    expect(noticePayload(apiLeaseSchema.parse(api.noticeDetail), parts)).toMatchObject({ lock_version: 4, replace: true });
  });
});

describe('dates : l’API lit des fins inclusives et écrit des fins exclusives', () => {
  it('résilie le lendemain du dernier jour', () => {
    expect(terminatePayload(lease, { lastDay: '2026-12-31' })).toEqual({ lock_version: 3, ends_on: '2027-01-01' });
  });

  it('laisse le serveur reprendre la date de départ du préavis', () => {
    expect(terminatePayload(lease, { lastDay: null })).toEqual({ lock_version: 3 });
  });

  it('transmet la résiliation amiable avec son motif', () => {
    expect(terminatePayload(lease, { lastDay: '2026-12-31', amicable: true, reason: 'Accord des parties', requestedBy: 'landlord' })).toEqual({
      lock_version: 3,
      ends_on: '2027-01-01',
      amicable: true,
      termination_reason: 'Accord des parties',
      requested_by: 'landlord',
    });
  });

  it('ferme une partie et un lot le lendemain du dernier jour, y compris en fin d’année', () => {
    expect(endPartyPayload(lease, '2026-12-31')).toEqual({ lock_version: 3, valid_to: '2027-01-01' });
    expect(endUnitPayload(lease, '2026-02-28', api.IDS.annex)).toEqual({ lock_version: 3, valid_to: '2026-03-01', replace_with_unit_id: api.IDS.annex });
  });
});

describe('autres écritures', () => {
  it('porte lock_version dans chaque action sur un bail existant', () => {
    expect(cancelPayload(lease)).toEqual({ lock_version: 3 });
    expect(signPayload(lease, '2026-11-16')).toEqual({ lock_version: 3, signed_on: '2026-11-16' });
    expect(renewPayload(lease, { durationMonths: 36, changes: [{ componentTermId: api.IDS.rentComponent, amount: 90000 }] })).toEqual({
      lock_version: 3,
      duration_months: 36,
      changes: [{ component_term_id: api.IDS.rentComponent, amount: 90000 }],
    });
    expect(revisePayload(lease, { effectiveOn: '2026-11-16', changes: [{ componentTermId: api.IDS.rentComponent, amount: 88000 }] })).toEqual({
      lock_version: 3,
      effective_on: '2026-11-16',
      reason: 'revision',
      changes: [{ component_term_id: api.IDS.rentComponent, amount: 88000 }],
    });
    expect(addPartyPayload(lease, { partyId: api.IDS.coTenant, role: 'guarantor', guaranteesPartyId: api.IDS.tenant, guaranteeLimit: 300000 })).toEqual({
      lock_version: 3,
      party_id: api.IDS.coTenant,
      role: 'guarantor',
      guarantees_party_id: api.IDS.tenant,
      guarantee_limit_amount: 300000,
    });
    expect(addUnitPayload(lease, { unitId: api.IDS.annex, validFrom: '2026-03-01' })).toEqual({ lock_version: 3, unit_id: api.IDS.annex, valid_from: '2026-03-01' });
  });

  it('ferme une composante sans montant', () => {
    expect(revisePayload(lease, { effectiveOn: '2026-11-16', changes: [{ componentTermId: api.IDS.chargesComponent, close: true }] }).changes).toEqual([{ component_term_id: api.IDS.chargesComponent, close: true }]);
  });
});
