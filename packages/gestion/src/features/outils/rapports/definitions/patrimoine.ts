import { formatDecimal, formatPercentValue, formatRoundedEuros, plural } from '../../analytique/format';
import { indexOfColumns, numberAt, sumAt } from '../engine/engine';
import { YEAR_PERIODS, inPeriod } from '../engine/periods';
import type { ReportCell, ReportDefinition, ReportRow } from '../engine/types';
import { GROUP_BUILDING, GROUP_NONE, isCurrent, lotIndex, makeRow, ratio } from './shared';

const VALEUR_COLUMNS = [
  { id: 'building', label: 'Immeuble', kind: 'text' },
  { id: 'lot', label: 'Bien', kind: 'text' },
  { id: 'year', label: 'Année d’achat', kind: 'text' },
  { id: 'price', label: 'Prix d’achat', kind: 'money', total: 'sum' },
  { id: 'fees', label: 'Frais', kind: 'money', total: 'sum' },
  { id: 'estimate', label: 'Valeur estimée', kind: 'money', total: 'sum' },
  { id: 'gain', label: 'Plus-value latente', kind: 'money', total: 'sum' },
] as const;
const valeur = indexOfColumns(VALEUR_COLUMNS);

export const valeurBiens: ReportDefinition = {
  slug: 'valeur-des-biens',
  title: 'VALEUR DES BIENS',
  description: 'Prix d’achat, frais et estimation actuelle de chaque lot.',
  periods: null,
  filters: { lot: true, tenant: false },
  groups: [GROUP_BUILDING, GROUP_NONE],
  columns: VALEUR_COLUMNS,
  note: 'Les lots sans prix d’achat renseigné sont signalés et exclus des totaux.',
  emptyHint: 'Aucun lot ne correspond à ce périmètre.',
  rows: ({ data }) => {
    const lots = lotIndex(data);
    return data.assets.map((asset) => {
      const lot = lots.get(asset.lotId);
      const building = lot?.buildingName ?? 'Autres';
      const known = asset.purchasePrice !== null;
      const gain = asset.estimatedValue !== null && asset.purchasePrice !== null ? asset.estimatedValue - asset.purchasePrice - (asset.fees ?? 0) : null;
      return makeRow(
        asset.lotId,
        { lotId: asset.lotId },
        { building },
        [building, lot?.name ?? asset.lotId, asset.purchaseYear === null ? 'Non renseigné' : String(asset.purchaseYear), asset.purchasePrice, asset.fees, asset.estimatedValue, gain],
        known ? undefined : 'warning',
      );
    });
  },
  kpis: (rows) => [
    { label: 'Prix d’achat cumulé', value: formatRoundedEuros(sumAt(rows, valeur('price'))) },
    { label: 'Valeur estimée', value: formatRoundedEuros(sumAt(rows, valeur('estimate'))) },
    { label: 'Plus-value latente', value: formatRoundedEuros(sumAt(rows, valeur('gain'))) },
    { label: 'Lots non renseignés', value: String(rows.filter((row) => row.tone === 'warning').length) },
  ],
};

const PRETS_COLUMNS = [
  { id: 'building', label: 'Bien financé', kind: 'text' },
  { id: 'bank', label: 'Banque', kind: 'text' },
  { id: 'borrowed', label: 'Capital emprunté', kind: 'money', total: 'sum' },
  { id: 'rate', label: 'Taux', kind: 'percent' },
  { id: 'monthly', label: 'Mensualité', kind: 'money', total: 'sum' },
  { id: 'remaining', label: 'Capital restant dû', kind: 'money', total: 'sum' },
  { id: 'interest', label: 'Intérêts de l’année', kind: 'money', total: 'sum' },
  { id: 'end', label: 'Dernière échéance', kind: 'text' },
  { id: 'status', label: 'Statut', kind: 'text' },
] as const;
const prets = indexOfColumns(PRETS_COLUMNS);

export const pretsImmobiliers: ReportDefinition = {
  slug: 'prets-immobiliers',
  title: 'PRÊTS IMMOBILIERS',
  description: 'Capital restant dû, mensualités et intérêts de chaque prêt.',
  periods: null,
  filters: { lot: false, tenant: false },
  groups: [GROUP_NONE, { value: 'bank', label: 'Regrouper par : Banque', attr: 'bank' }],
  columns: PRETS_COLUMNS,
  emptyHint: 'Aucun prêt immobilier n’est enregistré.',
  rows: ({ data }) =>
    data.loans.map((loan) =>
      makeRow(
        loan.id,
        {},
        { bank: loan.bank },
        [loan.buildingName, loan.bank, loan.borrowed, loan.rateBp / 100, loan.monthly, loan.remaining, loan.interestYear, `${loan.endMonth.slice(5)}/${loan.endMonth.slice(0, 4)}`, loan.status === 'rembourse' ? 'Remboursé' : 'En cours'],
      ),
    ),
  kpis: (rows) => [
    { label: 'Capital restant dû', value: formatRoundedEuros(sumAt(rows, prets('remaining'))) },
    { label: 'Mensualités', value: formatRoundedEuros(sumAt(rows, prets('monthly'))) },
    { label: 'Intérêts de l’année', value: formatRoundedEuros(sumAt(rows, prets('interest'))) },
    { label: 'Prêts', value: plural(rows.length, 'prêt', 'prêts') },
  ],
};

const RENTA_COLUMNS = [
  { id: 'building', label: 'Immeuble', kind: 'text' },
  { id: 'lot', label: 'Bien', kind: 'text' },
  { id: 'price', label: 'Investi (achat et frais)', kind: 'money', total: 'sum' },
  { id: 'rent', label: 'Loyers annuels', kind: 'money', total: 'sum' },
  { id: 'expenses', label: 'Dépenses', kind: 'money', total: 'sum' },
  { id: 'gross', label: 'Rendement brut', kind: 'percent', total: grossRate },
  { id: 'net', label: 'Rendement net', kind: 'percent', total: netRate },
] as const;
const renta = indexOfColumns(RENTA_COLUMNS);

const PRICE = 2;
const RENT = 3;
const EXPENSES = 4;

const percentOf = (part: number, base: number): ReportCell => (base === 0 ? null : Math.round(ratio(part, base) * 10) / 10);
const columnSum = (rows: readonly ReportRow[], index: number): number => rows.reduce((sum, row) => sum + numberAt(row, index), 0);

function grossRate(rows: readonly ReportRow[]): ReportCell {
  return percentOf(columnSum(rows, RENT), columnSum(rows, PRICE));
}

function netRate(rows: readonly ReportRow[]): ReportCell {
  return percentOf(columnSum(rows, RENT) - columnSum(rows, EXPENSES), columnSum(rows, PRICE));
}

export const rentabiliteBiens: ReportDefinition = {
  slug: 'rentabilite-par-bien',
  title: 'RENTABILITÉ PAR BIEN',
  description: 'Rendement brut et net de chaque lot loué.',
  periods: YEAR_PERIODS,
  filters: { lot: true, tenant: false },
  groups: [GROUP_BUILDING, GROUP_NONE],
  columns: RENTA_COLUMNS,
  note: 'Loyers annuels hors charges (loyer mensuel × 12). Rendement net : loyers moins dépenses enregistrées sur la période, rapportés au prix d’achat et aux frais.',
  emptyHint: 'Aucun lot loué n’a de prix d’achat renseigné.',
  rows: ({ data, period }) => {
    const lots = lotIndex(data);
    return data.leases.filter(isCurrent).flatMap((lease) => {
      const asset = data.assets.find((item) => item.lotId === lease.lotId);
      const price = asset?.purchasePrice ?? null;
      if (asset === undefined || price === null) return [];
      const lot = lots.get(lease.lotId);
      const invested = price + (asset.fees ?? 0);
      const annualRent = lease.rent * 12;
      const expenses = data.expenses.filter((expense) => expense.lotName === lot?.name && inPeriod(expense.date, period)).reduce((sum, expense) => sum + expense.amount, 0);
      const gross = Math.round(ratio(annualRent, invested) * 10) / 10;
      const net = Math.round(ratio(annualRent - expenses, invested) * 10) / 10;
      const building = lot?.buildingName ?? 'Autres';
      return [makeRow(lease.lotId, { lotId: lease.lotId, tenantId: lease.tenantId }, { building }, [building, lot?.name ?? lease.lotId, invested, annualRent, expenses, gross, net])];
    });
  },
  kpis: (rows) => {
    const gross = grossRate(rows);
    const net = netRate(rows);
    return [
      { label: 'Rendement brut moyen', value: gross === null ? '–' : formatPercentValue(Number(gross)) },
      { label: 'Rendement net moyen', value: net === null ? '–' : formatPercentValue(Number(net)) },
      { label: 'Loyers annuels', value: formatRoundedEuros(sumAt(rows, renta('rent'))) },
      { label: 'Capital investi', value: formatRoundedEuros(sumAt(rows, renta('price'))), caption: formatDecimal(rows.length, 0) + (rows.length > 1 ? ' lots' : ' lot') },
    ];
  },
};
