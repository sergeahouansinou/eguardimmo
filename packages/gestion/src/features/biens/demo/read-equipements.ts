import { formatMoney } from '../../../format/money';
import { formatDate, monthsBetween } from '../lib/dates';
import { CHARGED_LABELS, FAMILY_LABELS } from '../lib/labels';
import { slugify } from '../lib/text';
import { documentCategories } from './seed-documents';
import type { DocumentsData, Owner } from '../schemas/common';
import type {
  EquipementDetail,
  EquipementIntervData,
  EquipementRow,
  EquipementsData,
} from '../schemas/equipements';
import type { InventairesData, Reading, ReadingsData } from '../schemas/releves';
import { AS_OF, CURRENCY } from './records';
import type { EquipementRecord } from './records';
import type { DemoState } from './state';

export function placeNameOf(state: DemoState, row: EquipementRow): string {
  if (row.lotId) return state.lots.find((lot) => lot.row.id === row.lotId)?.row.name ?? row.placeName;
  const immeuble = state.immeubles.find((item) => item.row.id === row.immeubleId);
  return immeuble ? `${immeuble.row.name} (parties communes)` : row.placeName;
}

export function equipementRow(state: DemoState, record: EquipementRecord): EquipementRow {
  return { ...record.row, placeName: placeNameOf(state, record.row) };
}

export function buildEquipements(state: DemoState): EquipementsData {
  return { currency: CURRENCY, asOf: AS_OF, items: state.equipements.map((record) => equipementRow(state, record)) };
}

function genericRich(state: DemoState, record: EquipementRecord): NonNullable<EquipementRecord['rich']> {
  const row = equipementRow(state, record);
  const months = row.purchasedOn && row.warrantyEndsOn ? monthsBetween(row.purchasedOn, row.warrantyEndsOn) : 0;
  const underWarranty = row.warrantyEndsOn !== null && row.warrantyEndsOn >= AS_OF;
  const maintenance = record.log.reduce((sum, entry) => sum + (entry.done ? (entry.cost ?? 0) : 0), 0);
  const lastDone = record.log.find((entry) => entry.done);
  return {
    subtitle: `${row.placeName}${row.room ? ` · ${row.room}` : ''} · Famille ${FAMILY_LABELS[row.family].toLowerCase()}`,
    badges: [
      row.status === 'en_service' ? { label: 'En service', tone: 'success' } : { label: 'Hors service', tone: 'danger' },
      ...(underWarranty ? [{ label: 'Sous garantie', tone: 'info' as const }] : []),
    ],
    photoCount: 0,
    photos: [],
    identification: [
      { label: 'Marque', value: row.brand ?? '—' },
      { label: 'Modèle', value: row.model ?? '—' },
      { label: 'Emplacement', value: row.room ?? '—' },
      { label: 'Date d’achat', value: row.purchasedOn ? formatDate(row.purchasedOn) : '—' },
      { label: 'Prix d’achat', value: row.price === null ? '—' : formatMoney(row.price, CURRENCY) },
      { label: 'À la charge de', value: CHARGED_LABELS[row.chargedTo] },
    ],
    warranty: { coverage: 'Garantie constructeur', months, startsOn: row.purchasedOn, endsOn: row.warrantyEndsOn },
    maintenanceRows: [
      { label: 'Prochain entretien', value: row.nextMaintenanceOn ? formatDate(row.nextMaintenanceOn) : 'Non planifié' },
      { label: 'Dernier entretien', value: lastDone ? formatDate(lastDone.date) : '—' },
      { label: 'Prestataire', value: row.provider ?? '—' },
    ],
    cost: { total: (row.price ?? 0) + maintenance, maintenance, lifetimeYears: null, replacementYear: null },
    warrantyDocs: [],
    reasons: [],
  };
}

export function buildEquipementDetail(state: DemoState, id: string): EquipementDetail | null {
  const record = state.equipements.find((item) => item.row.id === id);
  if (!record) return null;
  const row = equipementRow(state, record);
  const rich = record.rich ?? genericRich(state, record);
  return {
    currency: CURRENCY,
    asOf: AS_OF,
    equipement: row,
    ...rich,
    photoCount: rich.photoCount + record.photoNames.length,
    photos: [...rich.photos, ...record.photoNames.map((label, index) => ({ id: `${slugify(label) || 'photo'}-${String(index + 1)}`, label, cover: rich.photos.length === 0 && index === 0 }))],
    plan: record.plan,
    log: record.log,
    values: {
      name: row.name,
      detail: row.detail,
      family: row.family,
      lotId: row.lotId,
      immeubleId: row.immeubleId,
      room: row.room ?? '',
      brand: row.brand ?? '',
      model: row.model ?? '',
      purchasedOn: row.purchasedOn,
      price: row.price,
      warrantyEndsOn: row.warrantyEndsOn,
      chargedTo: row.chargedTo,
      photoNames: record.photoNames,
    },
  };
}

const CORRECTIVE = /panne|réparation|dépannage|remplacement|fuite/i;

type IntervItem = EquipementIntervData['own'][number];

function logItems(record: EquipementRecord): IntervItem[] {
  const provider = record.row.provider ?? '—';
  return record.log
    .filter((entry) => entry.done && !/^installation/i.test(entry.title))
    .map((entry) => ({
      id: `${record.row.id}-${entry.id}`,
      date: entry.date,
      title: entry.title,
      equipment: record.row.name,
      provider,
      cost: entry.cost,
      costNote: null,
      status: { label: 'Terminée', tone: 'neutral' },
    }));
}

export function buildEquipementInterventions(state: DemoState, id: string): EquipementIntervData {
  const record = state.equipements.find((item) => item.row.id === id);
  if (!record) return { currency: CURRENCY, own: [], placeLabel: '—', breakdown: [], others: [] };
  const row = equipementRow(state, record);
  const all = logItems(record);
  const own = all.filter((item) => CORRECTIVE.test(item.title)).sort((a, b) => b.date.localeCompare(a.date));
  const sameLot = (item: EquipementRecord) => (row.lotId === null ? item.row.lotId === null && item.row.immeubleId === row.immeubleId : item.row.lotId === row.lotId);
  const siblings = state.equipements.filter((item) => item.row.id !== id && sameLot(item));
  const fromImmeuble = (state.immeubleExtras[row.immeubleId ?? '']?.interventions?.items ?? [])
    .filter((item) => item.place === row.placeName || (!row.lotId && item.place === 'Parties communes'))
    .map<IntervItem>((item) => ({
      id: `immeuble-${item.id}`,
      date: item.date,
      title: item.title,
      equipment: item.place,
      provider: item.provider,
      cost: item.cost,
      costNote: item.costNote,
      status: item.status,
    }));
  const others = [...fromImmeuble, ...siblings.flatMap((item) => logItems(item)), ...all]
    .sort((a, b) => b.date.localeCompare(a.date));
  const remaining = row.warrantyEndsOn && row.warrantyEndsOn >= AS_OF ? monthsBetween(AS_OF, row.warrantyEndsOn) : null;
  const breakdown: EquipementIntervData['breakdown'] = [
    remaining !== null && row.warrantyEndsOn
      ? { id: 'garantie', title: `Sous garantie jusqu’au ${formatDate(row.warrantyEndsOn)}`, detail: 'Pièces et main-d’œuvre, sans frais', pill: { label: `${String(remaining)} mois`, tone: 'info' }, ok: true }
      : { id: 'garantie', title: 'Garantie expirée ou non renseignée', detail: 'Les réparations sont à la charge du propriétaire', pill: null, ok: false },
    row.provider
      ? { id: 'prestataire', title: row.provider, detail: 'Prestataire habituel', pill: null, ok: true }
      : { id: 'prestataire', title: 'Aucun prestataire enregistré', detail: 'Renseignez-en un depuis la fiche', pill: null, ok: false },
  ];
  if (row.lotId) {
    breakdown.push({ id: 'signalement', title: 'Signalement par le locataire', detail: 'Depuis son espace, avec photos', pill: null, ok: true });
  }
  return { currency: CURRENCY, own, placeLabel: row.placeName, breakdown, others };
}

export function buildDocuments(state: DemoState, owner: Owner): DocumentsData {
  return {
    categories: documentCategories[owner.kind],
    items: state.documents.filter((item) => item.owner.kind === owner.kind && item.owner.id === owner.id).sort((a, b) => b.date.localeCompare(a.date)),
  };
}

export function readingView(state: DemoState, reading: Reading): Reading {
  const meter = state.meters.find((item) => item.id === reading.meterId);
  const lot = state.lots.find((item) => item.row.id === reading.lotId);
  return { ...reading, lotName: lot?.row.name ?? reading.lotName, meterRef: meter?.ref ?? reading.meterRef };
}

export function buildReadings(state: DemoState): ReadingsData {
  return {
    currency: CURRENCY,
    meters: state.meters,
    items: state.readings.map((reading) => readingView(state, reading)).sort((a, b) => b.date.localeCompare(a.date)),
  };
}

export function buildInventaires(state: DemoState, templates: string[]): InventairesData {
  return {
    currency: CURRENCY,
    templates,
    items: state.inventaires.map((item) => {
      const lot = state.lots.find((entry) => entry.row.id === item.lotId);
      const immeuble = state.immeubles.find((entry) => entry.row.id === lot?.row.immeubleId);
      return { ...item, lotName: lot?.row.name ?? item.lotName, immeubleName: immeuble?.row.name ?? item.immeubleName };
    }),
  };
}
