import { CURRENCIES } from '../../../format/money';
import type { Currency } from '../../../format/money';
import { countryName } from '../lib/country';
import { formatArea } from '../lib/amount';
import { LOT_TYPE_LABELS, SITE_TYPE_LABELS } from '../lib/labels';
import { externalPaths } from '../paths';
import type { Badge } from '../schemas/common';
import type { ImmeubleDetail, ImmeubleRow } from '../schemas/immeubles';
import type { LeaseData, LotDetail, LotRow, LotStatus, LotType, Period } from '../schemas/lots';
import { unexpectedResponse } from './apiErrors';
import type { ApiLeaseDetail, ApiOccupancy, ApiProperty, ApiPropertySummary, ApiUnit } from './apiSchemas';

const XOF_COUNTRIES: readonly string[] = ['BJ', 'BF', 'CI', 'GW', 'ML', 'NE', 'SN', 'TG'];

const TYPE_BY_KEY: Readonly<Record<string, LotType>> = {
  apartment: 'appartement',
  studio: 'studio',
  house: 'maison',
  parking: 'parking',
  office: 'bureau',
  garage: 'garage',
  cellar: 'cave',
  commercial_premises: 'local',
  land: 'terrain',
};

export const KEY_BY_TYPE: Readonly<Partial<Record<LotType, string>>> = Object.fromEntries(Object.entries(TYPE_BY_KEY).map(([key, type]) => [type, key]));

const REGIME_LABELS: Readonly<Record<string, string>> = {
  'fr.residential.furnished': 'Logement meublé (loi du 6 juillet 1989)',
  'fr.residential.unfurnished': 'Logement vide (loi du 6 juillet 1989)',
  'fr.residential.mobility': 'Bail mobilité (loi du 6 juillet 1989)',
  'fr.common_law': 'Droit commun (parking ou garage seul)',
};

const REVISION_EVENTS = { revision: 'Révision', amendment: 'Avenant', renewal: 'Renouvellement', correction: 'Correction' } as const;

export const toLotType = (key: string): LotType => TYPE_BY_KEY[key] ?? 'autre';

export function currencyOfCountry(country: string): Currency {
  return XOF_COUNTRIES.includes(country) ? 'XOF' : 'EUR';
}

export function toCurrency(code: string): Currency {
  const found = CURRENCIES.find((currency) => currency === code);
  if (found === undefined) throw unexpectedResponse(`devise ${code}`);
  return found;
}

const integerOf = (value: unknown): number | null => (typeof value === 'number' && Number.isInteger(value) ? value : null);
const flagOf = (value: unknown): boolean | null => (typeof value === 'boolean' ? value : null);

const characteristic = (unit: ApiUnit, key: string): unknown => unit.characteristics[key];

export const roomsOf = (unit: ApiUnit): number | null => integerOf(characteristic(unit, 'rooms'));
export const surfaceOf = (unit: ApiUnit): number | null => (unit.surface_hundredths === null ? null : unit.surface_hundredths / 100);

export function toImmeubleRow(property: ApiPropertySummary): ImmeubleRow {
  return {
    id: property.id,
    name: property.name,
    address: property.address.line1,
    postalCode: property.address.postal_code,
    city: property.address.city,
    country: countryName(property.address.country),
    lots: property.active_units_count,
    totalArea: null,
    repartition: null,
    copropriete: false,
    archived: property.archived_at !== null,
  };
}

export function toImmeubleDetail(property: ApiProperty): NonNullable<ImmeubleDetail> {
  const row = toImmeubleRow(property);
  const badges: Badge[] = [{ label: SITE_TYPE_LABELS[property.type], tone: 'neutral' }, ...(row.archived ? [{ label: 'Archivé', tone: 'neutral' as const }] : [])];
  return {
    currency: currencyOfCountry(property.address.country),
    immeuble: row,
    subtitle: `${row.address}, ${row.postalCode} ${row.city}`,
    badges,
    photoCount: 0,
    photos: [],
    facts: [
      { id: 'type', label: 'Type de bien', value: SITE_TYPE_LABELS[property.type] },
      { id: 'adresse', label: 'Adresse', value: [property.address.line1, property.address.line2].filter((part) => part).join(', ') },
      { id: 'ville', label: 'Ville', value: `${row.postalCode} ${row.city}, ${row.country}` },
      { id: 'lots', label: 'Lots actifs', value: String(property.active_units_count) },
    ],
    tantiemes: { sum: 0, total: 0 },
    totalLots: null,
    counts: { lots: property.active_units_count, equipements: null, documents: null, interventions: null },
    coproSummary: [],
    keys: [],
    values: { name: property.name, address: row.address, postalCode: row.postalCode, city: row.city, country: row.country, repartition: 'tantiemes', siteType: property.type, photoNames: [] },
  };
}

export interface TenantRef {
  id: string;
  name: string;
}

const tenantOf = (occupancy: ApiOccupancy | undefined): TenantRef | null => {
  const party = occupancy?.lease?.tenants[0];
  return party ? { id: party.id, name: party.display_name } : null;
};

function statusOf(occupancy: ApiOccupancy | undefined): LotStatus | null {
  if (occupancy === undefined) return null;
  if (occupancy.vacant) return 'a_louer';
  return occupancy.lease?.phase === 'notice' ? 'preavis' : null;
}

export function toLotRow(unit: ApiUnit, occupancy?: ApiOccupancy): LotRow {
  return {
    id: unit.id,
    name: unit.reference,
    immeubleId: unit.property.id,
    immeubleName: unit.property.name,
    type: toLotType(unit.unit_type.key),
    surface: surfaceOf(unit),
    rooms: roomsOf(unit),
    floor: unit.floor === null ? null : String(unit.floor),
    tenant: tenantOf(occupancy),
    rent: null,
    listing: null,
    status: statusOf(occupancy),
    tantiemes: null,
    elevatorShares: null,
    leaseEnd: occupancy?.lease?.end_date ?? null,
    leaseNote: null,
    archived: unit.archived_at !== null,
  };
}

const yesNo = (value: unknown): string | null => (flagOf(value) === null ? null : value === true ? 'Oui' : 'Non');

export function toLotDetail(unit: ApiUnit, property: ApiProperty, occupancy: ApiOccupancy | undefined): NonNullable<LotDetail> {
  const row = toLotRow(unit, occupancy);
  const rooms = roomsOf(unit);
  const year = integerOf(characteristic(unit, 'construction_year'));
  const rows = [
    { label: 'Type', value: LOT_TYPE_LABELS[row.type] },
    { label: 'Immeuble', value: property.name },
    { label: 'Étage', value: row.floor ?? 'Non renseigné' },
    { label: 'Surface', value: row.surface === null ? 'Non renseignée' : formatArea(row.surface) },
    ...(rooms === null ? [] : [{ label: 'Pièces', value: String(rooms) }]),
    ...(integerOf(characteristic(unit, 'bedrooms')) === null ? [] : [{ label: 'Chambres', value: String(characteristic(unit, 'bedrooms')) }]),
    ...(integerOf(characteristic(unit, 'bathrooms')) === null ? [] : [{ label: 'Salles de bains', value: String(characteristic(unit, 'bathrooms')) }]),
    ...(year === null ? [] : [{ label: 'Année de construction', value: String(year) }]),
    ...(yesNo(characteristic(unit, 'has_elevator')) === null ? [] : [{ label: 'Ascenseur', value: yesNo(characteristic(unit, 'has_elevator')) ?? '' }]),
    ...(yesNo(characteristic(unit, 'has_balcony')) === null ? [] : [{ label: 'Balcon', value: yesNo(characteristic(unit, 'has_balcony')) ?? '' }]),
  ];
  const tenantBadge: Badge = row.tenant ? { label: 'Loué', tone: 'success' } : { label: 'Vacant', tone: 'neutral' };
  return {
    currency: currencyOfCountry(property.address.country),
    lot: row,
    subtitle: [`${property.address.line1}, ${property.address.postal_code} ${property.address.city}`, row.floor === null ? 'Étage non renseigné' : `Étage ${row.floor}`, LOT_TYPE_LABELS[row.type]].join(' · '),
    badges: row.archived ? [{ label: 'Archivé', tone: 'neutral' }] : [tenantBadge, ...(row.status === 'preavis' ? [{ label: 'Préavis', tone: 'warning' as const }] : [])],
    photoCount: 0,
    photos: [],
    brief: {
      habitableArea: row.surface,
      carrezArea: null,
      rooms: rooms === null ? 'Non renseigné' : `${String(rooms)} pièce${rooms > 1 ? 's' : ''}`,
      floor: row.floor ?? 'Non renseigné',
      builtYear: year,
      rental: null,
      dpe: null,
      rentCc: null,
    },
    counts: { diagnostics: null, locations: null, equipements: null, documents: null },
    caracteristiques: [{ id: 'identification', title: 'Identification', editable: true, subSections: [], rows }],
    amenityGroups: [],
    values: {
      name: unit.reference,
      type: row.type,
      immeubleId: property.id,
      address: property.address.line1,
      complement: property.address.line2 ?? '',
      postalCode: property.address.postal_code,
      city: property.address.city,
      surface: row.surface,
      rooms,
      floor: row.floor ?? '',
      elevator: flagOf(characteristic(unit, 'has_elevator')) ?? false,
      heating: 'electrique',
      amenities: [],
      rent: null,
      charges: null,
      photoNames: [],
    },
  };
}

type Term = ApiLeaseDetail['terms'][number];

export function termsTotal(lease: ApiLeaseDetail, semantic: string, inForceOnly = true): number {
  return lease.terms.filter((term) => term.component.semantic_key === semantic && (!inForceOnly || term.in_force)).reduce((sum, term) => sum + term.amount.amount, 0);
}

export const regimeLabel = (key: string): string => REGIME_LABELS[key] ?? key;

export function toLeaseData(lease: ApiLeaseDetail): LeaseData {
  const tenant = lease.tenants[0];
  if (tenant === undefined) throw unexpectedResponse('bail sans locataire');
  return {
    currency: toCurrency(lease.currency),
    tenant: { id: tenant.id, name: tenant.display_name },
    leaseHref: externalPaths.lease(lease.id),
    kind: regimeLabel(lease.regime_key),
    startDate: lease.starts_on,
    endDate: lease.end_date,
    rentExcl: termsTotal(lease, 'rent'),
    provisions: termsTotal(lease, 'charges_provision'),
    deposit: termsTotal(lease, 'deposit'),
    nextRevision: null,
    balance: null,
  };
}

const PERIOD_STATUS = { running: 'en_cours', notice: 'preavis', ended: 'termine' } as const;

const rentTerms = (lease: ApiLeaseDetail): Term[] => lease.terms.filter((term) => term.component.semantic_key === 'rent').sort((a, b) => a.valid_from.localeCompare(b.valid_from));

export function toLeasePeriod(lease: ApiLeaseDetail): Period | null {
  if (lease.phase === 'draft' || lease.phase === 'upcoming' || lease.status === 'cancelled') return null;
  const rents = rentTerms(lease);
  const tenant = lease.tenants[0];
  return {
    id: lease.id,
    kind: 'bail',
    startDate: lease.starts_on,
    endDate: lease.end_date,
    occupant: tenant ? { id: tenant.id, name: tenant.display_name } : null,
    leaseType: regimeLabel(lease.regime_key),
    note: null,
    status: PERIOD_STATUS[lease.phase],
    noticeEndsOn: lease.notice?.departure_on ?? null,
    entryRent: rents[0]?.amount.amount ?? null,
    lastRent: rents.at(-1)?.amount.amount ?? null,
    deposit: lease.terms.some((term) => term.component.semantic_key === 'deposit') ? termsTotal(lease, 'deposit') : null,
    exitNote: null,
  };
}

export function toRentSteps(leases: readonly ApiLeaseDetail[]): { year: number; rent: number; event: string | null }[] {
  const steps = new Map<number, { year: number; rent: number; event: string | null }>();
  [...leases]
    .sort((a, b) => a.starts_on.localeCompare(b.starts_on))
    .forEach((lease, index) => {
      for (const term of rentTerms(lease)) {
        const year = Number(term.valid_from.slice(0, 4));
        const event = term.reason === 'initial' ? (index === 0 ? null : 'Nouveau bail') : REVISION_EVENTS[term.reason];
        steps.set(year, { year, rent: term.amount.amount, event });
      }
    });
  return [...steps.values()].sort((a, b) => a.year - b.year);
}
