import { formatArea } from '../lib/amount';
import { REPARTITION_LABELS } from '../lib/labels';
import { plural, slugify } from '../lib/text';
import type { ChargesData, CoproData, ImmeubleDetail, ImmeubleIntervData, ImmeubleRow, ImmeublesData } from '../schemas/immeubles';
import { AS_OF, CURRENCY } from './records';
import type { ImmeubleRecord } from './records';
import type { DemoState } from './state';

function activeLots(state: DemoState, immeubleId: string) {
  return state.lots.filter((lot) => lot.row.immeubleId === immeubleId && !lot.row.archived);
}

export function immeubleRow(state: DemoState, record: ImmeubleRecord): ImmeubleRow {
  const lots = activeLots(state, record.row.id);
  return {
    ...record.row,
    lots: lots.length,
    totalArea: Math.round(lots.reduce((sum, lot) => sum + lot.row.surface, 0) * 10) / 10,
  };
}

export function buildImmeubles(state: DemoState): ImmeublesData {
  return { items: state.immeubles.map((record) => immeubleRow(state, record)) };
}

export function buildImmeubleDetail(state: DemoState, id: string): ImmeubleDetail | null {
  const record = state.immeubles.find((item) => item.row.id === id);
  if (!record) return null;
  const extras = state.immeubleExtras[id];
  const row = immeubleRow(state, record);
  const facts = [
    { id: 'construction', label: 'Construction', value: record.builtYear === null ? '—' : String(record.builtYear) },
    { id: 'niveaux', label: 'Niveaux', value: record.levels ?? '—' },
    { id: 'chauffage', label: 'Chauffage', value: record.heating ?? '—' },
    { id: 'repartition', label: 'Clé de répartition', value: REPARTITION_LABELS[row.repartition] },
    { id: 'surface', label: 'Surface des lots', value: formatArea(row.totalArea) },
    ...(record.syndic === null ? [] : [{ id: 'syndic', label: 'Syndic', value: record.syndic }]),
    ...(record.registration === null ? [] : [{ id: 'immatriculation', label: 'Immatriculation', value: record.registration }]),
  ];
  const labels = record.photoLabels;
  return {
    currency: CURRENCY,
    immeuble: row,
    subtitle: [
      `${row.address}, ${row.postalCode} ${row.city}`,
      record.builtYear === null ? null : `Construit en ${String(record.builtYear)}`,
      record.totalLots === null ? plural(row.lots, 'lot') : `${plural(record.totalLots, 'lot')}, dont ${String(row.lots)} à vous`,
    ]
      .filter((part) => part !== null)
      .join(' · '),
    badges: extras?.badges ?? [],
    photoCount: Math.max(record.photoCount, labels.length) + record.photoNames.length,
    photos: [...labels, ...record.photoNames].map((label, index) => ({ id: `${slugify(label) || 'photo'}-${String(index + 1)}`, label, cover: index === 0 })),
    facts,
    tantiemes: {
      sum: activeLots(state, id).reduce((sum, lot) => sum + (lot.row.tantiemes ?? 0), 0),
      total: record.tantiemesTotal,
    },
    totalLots: record.totalLots,
    counts: {
      lots: row.lots,
      equipements: state.equipements.filter((item) => item.row.immeubleId === id && !item.row.archived).length,
      documents: state.documents.filter((item) => item.owner.kind === 'immeuble' && item.owner.id === id).length,
      interventions: extras?.interventions?.items.length ?? 0,
    },
    coproSummary: extras?.coproSummary ?? [],
    keys: extras?.keys ?? [],
    values: {
      name: row.name,
      address: row.address,
      postalCode: row.postalCode,
      city: row.city,
      country: row.country,
      repartition: row.repartition,
      photoNames: record.photoNames,
    },
  };
}

export function buildCharges(state: DemoState, id: string): ChargesData {
  const charges = state.immeubleExtras[id]?.charges;
  if (charges) return { currency: CURRENCY, ...charges };
  return { currency: CURRENCY, year: Number(AS_OF.slice(0, 4)), sharePerMille: 0, fundPercent: 0, lines: [], keys: [], regularisation: [] };
}

export function buildCopro(state: DemoState, id: string): CoproData | null {
  const record = state.immeubles.find((item) => item.row.id === id);
  const copro = state.immeubleExtras[id]?.copro;
  if (!record?.row.copropriete || !copro) return null;
  return { currency: CURRENCY, ...copro };
}

export function buildImmeubleInterventions(state: DemoState, id: string): ImmeubleIntervData {
  const interventions = state.immeubleExtras[id]?.interventions;
  if (interventions) return { currency: CURRENCY, ...interventions };
  return { currency: CURRENCY, year: Number(AS_OF.slice(0, 4)), averageCloseDays: null, items: [], claims: [], providers: [] };
}
