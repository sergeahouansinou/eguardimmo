import { describe, expect, it } from 'vitest';
import { tenantDetailSchema, tenantSchema } from '../schemas';
import { addressLine, isTenantCandidate, monthlyTotal, tenantStateOf, toBankAccount, toIdentifier, toTenantDetail, toTenantFromParty, toTenantFromSummary } from './apiMapping';
import { apiLeaseDetailSchema, apiPartySchema, apiPartySummarySchema, apiTenancyLineSchema } from './apiSchemas';
import * as api from './responses.fixtures';

const TODAY = '2026-11-16';
const line = (overrides: Record<string, unknown> = {}) => apiTenancyLineSchema.parse(api.line(overrides));

describe('fixtures', () => {
  it('respectent les schémas de réponse du serveur', () => {
    expect(() => apiPartySchema.parse(api.awaDetail)).not.toThrow();
    expect(() => apiPartySchema.parse(api.societeDetail)).not.toThrow();
    expect(() => apiLeaseDetailSchema.parse(api.leaseDetail)).not.toThrow();
  });
});

describe('toTenantFromSummary', () => {
  it('range le nom d’affichage et les coordonnées principales, sans solde inventé', () => {
    const tenant = toTenantFromSummary(apiPartySummarySchema.parse(api.awaSummary), [line()], TODAY);
    expect(tenantSchema.parse(tenant)).toMatchObject({
      id: api.IDS.awa,
      kind: 'particulier',
      firstName: 'Awa Diallo',
      email: 'awa.diallo@example.com',
      phone: '+33 6 00 00 00 01',
      unitId: api.IDS.unit,
      status: 'actif',
      state: 'en_cours',
      since: '2026-01-01',
      balance: 0,
      portalActive: false,
    });
  });

  it('place la raison sociale d’une société et marque un contact archivé', () => {
    const company = toTenantFromSummary(apiPartySummarySchema.parse(api.societeSummary), [], TODAY);
    expect(company).toMatchObject({ kind: 'societe', companyName: 'Ramonage du Port SARL', state: 'sans_bail', unitId: null, since: '' });
    expect(toTenantFromSummary(apiPartySummarySchema.parse(api.ninaSummary), [], TODAY).status).toBe('archive');
  });
});

describe('toTenantFromParty', () => {
  it('lit la fiche complète avec valeurs masquées uniquement', () => {
    const tenant = toTenantFromParty(apiPartySchema.parse(api.awaDetail), [line()], TODAY);
    expect(tenant).toMatchObject({
      firstName: 'Awa',
      lastName: 'Diallo',
      birthDate: '1990-05-12',
      address: '12 rue du Port, 13002 Marseille',
      idDocType: 'passeport',
      idLast4: '4567',
      ibanLast4: '0189',
      idExpiry: null,
      idFileName: null,
    });
    expect(JSON.stringify(tenant)).not.toMatch(/FR76|AGRIFRPP/);
  });
});

describe('état et sélection des locataires', () => {
  it('déduit le préavis puis le bail en cours puis l’absence de bail', () => {
    expect(tenantStateOf([line({ phase: 'notice' }), line({ phase: 'running' })], TODAY)).toBe('preavis');
    expect(tenantStateOf([line({ phase: 'upcoming' })], TODAY)).toBe('en_cours');
    expect(tenantStateOf([line({ phase: 'ended' })], TODAY)).toBe('sans_bail');
    expect(tenantStateOf([line({ end_date: '2026-10-31' })], TODAY)).toBe('sans_bail');
    expect(tenantStateOf([line({ role: 'guarantor' })], TODAY)).toBe('sans_bail');
  });

  it('écarte une partie qui n’est que garant ou occupant, garde celle sans bail', () => {
    expect(isTenantCandidate([])).toBe(true);
    expect(isTenantCandidate([line({ role: 'guarantor' })])).toBe(false);
    expect(isTenantCandidate([line({ role: 'occupant' }), line()])).toBe(true);
  });

  it('écarte une partie sans bail qui porte une catégorie de contact, sauf si elle est aussi locataire', () => {
    expect(isTenantCandidate([], true)).toBe(false);
    expect(isTenantCandidate([line()], true)).toBe(true);
  });

  it('formate une adresse partielle', () => {
    expect(addressLine(null)).toBe('');
    expect(addressLine({ line1: '1 rue A', line2: 'Bât. B', postal_code: '75001', city: 'Paris', country: 'FR' })).toBe('1 rue A, Bât. B, 75001 Paris');
  });
});

describe('toTenantDetail', () => {
  it('additionne loyer et charges en vigueur, liste les baux et les garants', () => {
    const lease = apiLeaseDetailSchema.parse(api.leaseDetail);
    expect(monthlyTotal(lease)).toBe(91000);
    const detail = toTenantDetail(api.IDS.awa, [line(), line({ id: api.IDS.leaseOld, reference: 'BL-2024-0003', phase: 'ended', since: '2024-01-01', end_date: '2025-12-31', main_unit: null })], lease);
    expect(tenantDetailSchema.parse(detail)).toMatchObject({
      rent: 91000,
      leaseEnd: '2028-12-31',
      nextNoticeOn: null,
      payments: [],
      documents: [],
      messages: [],
      activities: [],
      guarantors: [{ title: 'Paul Garant', detail: 'Garant du bail BL-2026-0001' }],
    });
    expect(detail.leases.map((row) => [row.title, row.badge.label, row.href])).toEqual([
      ['A12, Résidence du Port', 'En cours', `/baux/${api.IDS.lease}`],
      ['BL-2024-0003', 'Terminé', `/baux/${api.IDS.leaseOld}`],
    ]);
  });

  it('garde la devise du bail pour le loyer au lieu de le mettre à zéro', () => {
    const lease = apiLeaseDetailSchema.parse({ ...api.leaseDetail, currency: 'XOF' });
    expect(monthlyTotal(lease)).toBe(91000);
    expect(tenantDetailSchema.parse(toTenantDetail(api.IDS.awa, [line()], lease))).toMatchObject({ rent: 91000, rentCurrency: 'XOF' });
  });

  it('n’invente aucun loyer pour une devise inconnue', () => {
    const lease = apiLeaseDetailSchema.parse({ ...api.leaseDetail, currency: 'USD' });
    const detail = tenantDetailSchema.parse(toTenantDetail(api.IDS.awa, [line()], lease));
    expect(detail.rent).toBe(0);
    expect(detail.rentCurrency).toBeUndefined();
  });

  it('indique le rôle quand la partie est garante', () => {
    const detail = toTenantDetail(api.IDS.garant, [line({ role: 'guarantor' })], null);
    expect(detail.leases[0]?.detail).toContain('Garant · BL-2026-0001');
    expect(detail.rent).toBe(0);
  });
});

describe('valeurs sensibles', () => {
  it('ne reprennent que les quatre derniers chiffres', () => {
    expect(toBankAccount(api.bankAccount)).toEqual({ id: api.IDS.bank, ibanLast4: '0189', bic: 'AGRIFRPP', holderName: 'Awa Diallo', validFrom: '2026-01-01', validTo: null, active: true });
    expect(toIdentifier(api.passport as never)).toEqual({ id: api.IDS.passport, scheme: 'passport', country: 'FR', last4: '4567' });
  });
});
