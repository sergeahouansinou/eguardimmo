export const IDS = {
  org: '0b5f2c1e-6d7a-4c8e-9a41-2f6d8e7c1a10',
  property: '01935b30-0000-7000-8000-000000000001',
  propertyBj: '01935b30-0000-7000-8000-000000000002',
  propertyArchived: '01935b30-0000-7000-8000-000000000003',
  unit: '01935b20-0000-7000-8000-000000000001',
  unitNotice: '01935b20-0000-7000-8000-000000000002',
  unitVacant: '01935b20-0000-7000-8000-000000000003',
  unitArchived: '01935b20-0000-7000-8000-000000000004',
  annex: '01935b20-0000-7000-8000-000000000005',
  termApartment: '01935b90-0000-7000-8000-000000000001',
  termParking: '01935b90-0000-7000-8000-000000000002',
  termCustom: '01935b90-0000-7000-8000-000000000003',
  lease: '01935b10-0000-7000-8000-000000000001',
  leaseOld: '01935b10-0000-7000-8000-000000000002',
  tenant: '01935b40-0000-7000-8000-000000000001',
  tenantOld: '01935b40-0000-7000-8000-000000000002',
  owner: '01935b40-0000-7000-8000-000000000009',
  ownership: '01935ba0-0000-7000-8000-000000000001',
  rentComponent: '01935b50-0000-7000-8000-000000000001',
  chargesComponent: '01935b50-0000-7000-8000-000000000002',
  depositComponent: '01935b50-0000-7000-8000-000000000003',
};

const address = { line1: '12 rue des Lilas', line2: 'Bâtiment B', postal_code: '75011', city: 'Paris', country: 'FR' };

export const propertySummary = {
  id: IDS.property,
  name: 'Résidence du Port',
  type: 'building',
  address,
  active_units_count: 3,
  archived_at: null,
};

export const propertyDetail = {
  ...propertySummary,
  custom_fields: {},
  lock_version: 4,
  tags: [{ id: '01935bb0-0000-7000-8000-000000000001', name: 'Centre-ville', slug: 'centre-ville', color: 'blue' }],
};

export const propertyBjSummary = { ...propertySummary, id: IDS.propertyBj, name: 'Villa Fidjrossè', type: 'house', address: { line1: 'Rue 12', line2: null, postal_code: '01 BP 100', city: 'Cotonou', country: 'BJ' }, active_units_count: 1 };
export const propertyBjDetail = { ...propertyBjSummary, custom_fields: {}, lock_version: 2, tags: [] };
export const propertyArchivedSummary = { ...propertySummary, id: IDS.propertyArchived, name: 'Ancien site', active_units_count: 0, archived_at: '2026-03-01T08:30:00+00:00' };

export const unitType = (key: string, label: string, semantic: string | null, id: string) => ({ id, key, label, semantic_key: semantic });
export const apartmentType = unitType('apartment', 'Appartement', 'residential', IDS.termApartment);
export const parkingType = unitType('parking', 'Parking', 'parking', IDS.termParking);

export const unitSummary = {
  id: IDS.unit,
  property: { id: IDS.property, name: 'Résidence du Port' },
  parent_unit_id: null,
  unit_type: apartmentType,
  reference: 'A12',
  floor: 3,
  surface_hundredths: 5435,
  characteristics: { rooms: 3, has_elevator: true, construction_year: 1998 },
  custom_fields: {},
  lock_version: 7,
  archived_at: null,
};
export const unitNotice = { ...unitSummary, id: IDS.unitNotice, reference: 'A13', floor: 0, surface_hundredths: 4000, characteristics: { rooms: 2 }, lock_version: 2 };
export const unitVacant = { ...unitSummary, id: IDS.unitVacant, reference: 'P03', unit_type: parkingType, floor: -1, surface_hundredths: null, characteristics: {}, lock_version: 1 };
export const unitArchived = { ...unitSummary, id: IDS.unitArchived, reference: 'Z99', unit_type: unitType('custom_loft', 'Loft', 'residential', IDS.termCustom), archived_at: '2026-02-01T09:00:00+00:00', lock_version: 3 };
export const unitDetail = { ...unitSummary, tags: [] };

export const unitTreeResponse = { data: { ...unitSummary, annexes: [{ ...unitVacant, id: IDS.annex, parent_unit_id: IDS.unit, annexes: [] }] } };

export const cursorMeta = (path: string, nextCursor: string | null) => ({
  links: { first: null, last: null, prev: null, next: nextCursor === null ? null : `https://api.test${path}?cursor=${nextCursor}` },
  meta: { path: `https://api.test${path}`, per_page: 100, next_cursor: nextCursor, prev_cursor: null },
});
export const pageOf = (path: string, items: readonly unknown[], nextCursor: string | null = null) => ({ data: items, ...cursorMeta(path, nextCursor) });

export const detail = (data: unknown) => ({ data });

export const unitTypeTerms = {
  data: [
    { id: IDS.termApartment, vocabulary: 'unit_type', key: 'apartment', labels: { fr: 'Appartement' }, semantic_key: 'residential', parent_id: null, position: 1, metadata: {}, platform: true, system: true, archived: false, hidden: false, overridden: false },
    { id: IDS.termParking, vocabulary: 'unit_type', key: 'parking', labels: { fr: 'Parking' }, semantic_key: 'parking', parent_id: null, position: 4, metadata: {}, platform: true, system: true, archived: false, hidden: false, overridden: false },
    { id: '01935b90-0000-7000-8000-000000000009', vocabulary: 'unit_type', key: 'office', labels: { fr: 'Bureau' }, semantic_key: 'commercial', parent_id: null, position: 8, metadata: {}, platform: true, system: true, archived: true, hidden: false, overridden: false },
  ],
};

const party = (id: string, name: string) => ({ id, display_name: name, kind: 'person', is_anonymized: false });
export const tenant = party(IDS.tenant, 'Awa Diallo');
export const tenantOld = party(IDS.tenantOld, 'Marc Chevalier');

export const occupancyResponse = {
  data: [
    { unit: { id: IDS.unit, reference: 'A12', property: { id: IDS.property, name: 'Résidence du Port' } }, vacant: false, since: '2026-01-01', lease: { id: IDS.lease, reference: 'BL-2026-0001', phase: 'running', starts_on: '2026-01-01', end_date: '2028-12-31', tenants: [tenant] } },
    { unit: { id: IDS.unitNotice, reference: 'A13', property: { id: IDS.property, name: 'Résidence du Port' } }, vacant: false, since: '2025-05-01', lease: { id: IDS.leaseOld, reference: 'BL-2025-0004', phase: 'notice', starts_on: '2025-05-01', end_date: '2026-12-31', tenants: [tenantOld] } },
    { unit: { id: IDS.unitVacant, reference: 'P03', property: { id: IDS.property, name: 'Résidence du Port' } }, vacant: true, since: null, lease: null },
  ],
};

const eur = (amount: number) => ({ amount, currency: 'EUR' });
const term = (id: string, component: string, semantic: string, amount: number, validFrom: string, reason: string, inForce = true) => ({
  id,
  component: { id: component, key: semantic, label: semantic, semantic_key: semantic },
  amount: eur(amount),
  vat_bp: 0,
  indexed: false,
  valid_from: validFrom,
  end_date: null,
  in_force: inForce,
  reason,
  replaces_id: null,
});

const leaseBase = {
  jurisdiction: 'FR',
  duration_months: 36,
  tacit_renewal: true,
  periodicity: 'monthly',
  currency: 'EUR',
  main_unit: { id: IDS.unit, reference: 'A12', property: { id: IDS.property, name: 'Résidence du Port' } },
  lock_version: 5,
  archived_at: null,
  billing_timing: 'advance',
  due_day: 5,
  payment_method: 'transfer',
  signed_on: '2025-12-20',
  signed_file_id: null,
  jurisdiction_data: {},
  custom_fields: {},
  note: null,
  units: [],
  parties: [],
};

export const leaseCurrent = {
  ...leaseBase,
  id: IDS.lease,
  reference: 'BL-2026-0001',
  regime_key: 'fr.residential.unfurnished',
  status: 'signed',
  phase: 'running',
  starts_on: '2026-01-01',
  end_date: '2028-12-31',
  tenants: [tenant],
  notice: null,
  terms: [
    term('01935b60-0000-7000-8000-000000000001', IDS.rentComponent, 'rent', 85000, '2026-01-01', 'initial', false),
    term('01935b60-0000-7000-8000-000000000002', IDS.rentComponent, 'rent', 88000, '2026-11-01', 'revision'),
    term('01935b60-0000-7000-8000-000000000003', IDS.chargesComponent, 'charges_provision', 6000, '2026-01-01', 'initial'),
    term('01935b60-0000-7000-8000-000000000004', IDS.depositComponent, 'deposit', 85000, '2026-01-01', 'initial'),
  ],
};

export const leaseEnded = {
  ...leaseBase,
  id: IDS.leaseOld,
  reference: 'BL-2024-0002',
  regime_key: 'fr.residential.furnished',
  status: 'terminated',
  phase: 'ended',
  starts_on: '2024-02-01',
  end_date: '2025-08-31',
  tenants: [tenantOld],
  notice: { received_on: '2025-05-15', given_by: 'tenant', departure_on: '2025-08-31', reason: null },
  terms: [term('01935b60-0000-7000-8000-000000000011', IDS.rentComponent, 'rent', 79000, '2024-02-01', 'initial')],
};

export const leaseSummaryOf = (lease: typeof leaseCurrent | typeof leaseEnded) => ({
  id: lease.id,
  reference: lease.reference,
  jurisdiction: 'FR',
  regime_key: lease.regime_key,
  status: lease.status,
  phase: lease.phase,
  starts_on: lease.starts_on,
  end_date: lease.end_date,
  duration_months: 36,
  tacit_renewal: true,
  periodicity: 'monthly',
  currency: 'EUR',
  main_unit: leaseBase.main_unit,
  tenants: lease.tenants,
  lock_version: 5,
  archived_at: null,
});

export const ownership = { id: IDS.ownership, unit_id: IDS.unit, party_id: IDS.owner, share_bp: 10000, nature: 'full', valid_from: '2023-06-15', valid_to: null };

export const problem = (status: number, code: string, title: string, detail: string, extensions: Record<string, unknown> = {}) => ({
  type: `https://api.test/problems/${code}`,
  title,
  status,
  detail,
  code,
  ...extensions,
});

export const staleUnitProblem = problem(409, 'unit_version_conflict', 'Lot modifié entre-temps', 'Le lot a été modifié depuis sa lecture : rechargez-le avant de renvoyer vos changements.');
export const stalePropertyProblem = problem(409, 'property_version_conflict', 'Site modifié entre-temps', 'Le site a été modifié depuis sa lecture : rechargez-le avant de renvoyer vos changements.');
