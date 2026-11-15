import { formatMoney } from '../../../format/money';
import { formatArea } from '../lib/amount';
import { addMonths } from '../lib/dates';
import { HEATING_LABELS, LOT_STATUS_LABELS, LOT_TYPE_LABELS } from '../lib/labels';
import { AMENITIES } from '../schemas/lots';
import type {
  DiagnosticsData,
  LeaseData,
  LotDetail,
  LotFinances,
  LotRow,
  LotSuivi,
  LotsData,
  OccupationData,
} from '../schemas/lots';
import type { Badge } from '../schemas/common';
import { slugify } from '../lib/text';
import { AS_OF, CURRENCY } from './records';
import type { LotRecord, LotRichDetail } from './records';
import { emptyLotExtras } from './state';
import type { DemoState } from './state';

export function lotRow(state: DemoState, record: LotRecord): LotRow {
  const immeuble = state.immeubles.find((item) => item.row.id === record.row.immeubleId);
  return { ...record.row, immeubleName: immeuble?.row.name ?? record.row.immeubleId };
}

export function buildLots(state: DemoState): LotsData {
  return { currency: CURRENCY, items: state.lots.map((record) => lotRow(state, record)) };
}

function statusBadges(record: LotRecord): Badge[] {
  const { row } = record;
  if (row.tenant === null) return [{ label: row.archived ? 'Archivé' : 'Vacant', tone: 'neutral' }];
  const status = LOT_STATUS_LABELS[row.status];
  const badges: Badge[] = [{ label: 'Loué', tone: 'success' }];
  if (row.status !== 'a_jour') badges.push({ label: status.label, tone: status.tone });
  return badges;
}

function genericRich(state: DemoState, record: LotRecord): LotRichDetail {
  const immeuble = state.immeubles.find((item) => item.row.id === record.row.immeubleId);
  const { row } = record;
  const amenityLabels = AMENITIES.filter((item) => record.amenities.includes(item.id)).map((item) => item.label);
  return {
    subtitle: `${record.street}, ${record.postalCode} ${record.city} · ${row.floor ?? 'Étage non renseigné'} · ${LOT_TYPE_LABELS[row.type]}`,
    badges: statusBadges(record),
    brief: {
      habitableArea: row.surface,
      carrezArea: null,
      rooms: row.rooms > 0 ? `${String(row.rooms)} pièce${row.rooms > 1 ? 's' : ''}` : 'Sans pièce',
      floor: row.floor ?? 'Non renseigné',
      builtYear: immeuble?.builtYear ?? null,
      rental: 'Vide, loi de 1989',
      dpe: null,
      rentCc: row.rent,
    },
    caracteristiques: [
      {
        id: 'identification',
        title: 'Identification',
        editable: true,
        subSections: [],
        rows: [
          { label: 'Type', value: LOT_TYPE_LABELS[row.type] },
          { label: 'Immeuble', value: immeuble?.row.name ?? '—' },
          { label: 'Étage', value: row.floor ?? '—' },
          { label: 'Surface', value: formatArea(row.surface) },
          { label: 'Pièces', value: String(row.rooms) },
          { label: 'Ascenseur', value: record.elevator ? 'Oui' : 'Non' },
          { label: 'Chauffage', value: HEATING_LABELS[record.heating] },
        ],
      },
      {
        id: 'loyer',
        title: 'Loyer et charges',
        editable: true,
        subSections: [],
        rows: [
          { label: 'Loyer hors charges', value: formatMoney(record.rentExcl, CURRENCY) },
          { label: 'Provisions pour charges', value: formatMoney(record.charges, CURRENCY) },
          { label: 'Loyer charges comprises', value: formatMoney(row.rent, CURRENCY) },
        ],
      },
    ],
    amenityGroups: amenityLabels.length > 0 ? [{ title: 'Logement', items: amenityLabels }] : [],
    photoLabels: [],
    photoCount: 0,
  };
}

function lotCounts(state: DemoState, record: LotRecord) {
  const extras = state.lotExtras[record.row.id];
  return {
    diagnostics: extras?.diagnostics?.items.length ?? 0,
    locations: extras?.occupation?.periods.filter((period) => period.kind === 'bail').length ?? 0,
    equipements: state.equipements.filter((item) => item.row.lotId === record.row.id && !item.row.archived).length,
    documents: state.documents.filter((item) => item.owner.kind === 'lot' && item.owner.id === record.row.id).length,
  };
}

export function buildLotDetail(state: DemoState, id: string): LotDetail | null {
  const record = state.lots.find((item) => item.row.id === id);
  if (!record) return null;
  const rich = { ...genericRich(state, record), ...record.rich };
  return {
    currency: CURRENCY,
    lot: lotRow(state, record),
    subtitle: rich.subtitle,
    badges: rich.badges,
    photoCount: Math.max(rich.photoCount, rich.photoLabels.length) + record.photoNames.length,
    photos: [...rich.photoLabels, ...record.photoNames].map((label, index) => ({ id: `${slugify(label) || 'photo'}-${String(index + 1)}`, label, cover: index === 0 })),
    brief: { ...rich.brief, habitableArea: record.row.surface, rentCc: record.row.rent },
    counts: lotCounts(state, record),
    caracteristiques: rich.caracteristiques,
    amenityGroups: rich.amenityGroups,
    values: {
      name: record.row.name,
      type: record.row.type,
      immeubleId: record.row.immeubleId,
      address: record.street,
      complement: record.complement,
      postalCode: record.postalCode,
      city: record.city,
      surface: record.row.surface,
      rooms: record.row.rooms,
      floor: record.row.floor ?? '',
      elevator: record.elevator,
      heating: record.heating,
      amenities: record.amenities,
      rent: record.rentExcl,
      charges: record.charges,
      photoNames: record.photoNames,
    },
  };
}

export function buildOccupation(state: DemoState, id: string): OccupationData {
  const occupation = state.lotExtras[id]?.occupation;
  if (!occupation) return { currency: CURRENCY, asOf: AS_OF, acquisitionDate: AS_OF, periods: [], rentSteps: [], inspections: [] };
  return { currency: CURRENCY, ...occupation };
}

export function buildLease(state: DemoState, id: string): LeaseData | null {
  const record = state.lots.find((item) => item.row.id === id);
  const tenant = record?.row.tenant;
  if (!record || !tenant) return null;
  const lease = state.lotExtras[id]?.lease;
  if (lease) return { currency: CURRENCY, ...lease };
  const { row } = record;
  return {
    currency: CURRENCY,
    tenant,
    leaseHref: '/baux',
    kind: 'Bail d’habitation',
    startDate: row.leaseEnd ? addMonths(row.leaseEnd, -36) : '2024-01-01',
    endDate: row.leaseEnd,
    rentExcl: record.rentExcl,
    provisions: record.charges,
    deposit: record.rentExcl,
    nextRevision: null,
    balance: row.status === 'retard' ? -row.rent : 0,
  };
}

export function buildDiagnostics(state: DemoState, id: string): DiagnosticsData {
  return state.lotExtras[id]?.diagnostics ?? { asOf: AS_OF, items: [], dpe: null };
}

export function buildSuivi(state: DemoState, id: string): LotSuivi {
  return state.lotExtras[id]?.suivi ?? { interventions: [] };
}

export function buildFinances(state: DemoState, id: string): LotFinances {
  const finances = state.lotExtras[id]?.finances;
  if (finances) return { currency: CURRENCY, ...finances };
  const record = state.lots.find((item) => item.row.id === id);
  const due = record?.row.status === 'retard' ? record.row.rent : 0;
  return {
    currency: CURRENCY,
    purchasePrice: null,
    purchaseYear: null,
    fees: null,
    estimatedValue: null,
    estimatedYear: null,
    remainingCapital: null,
    loanPayment: null,
    balanceDue: due,
    balanceNote: due > 0 ? 'Loyer et charges du mois' : null,
    months: [],
    operations: [],
  };
}

export function lotExtrasOf(state: DemoState, id: string) {
  const existing = state.lotExtras[id];
  if (existing) return existing;
  const created = emptyLotExtras();
  state.lotExtras[id] = created;
  return created;
}
