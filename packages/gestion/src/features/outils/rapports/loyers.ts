import type { Cell, Dataset } from '../analytique/csv';
import { ratioPercent } from '../analytique/format';
import type { LoyerLot, LoyersData } from './schemas';

export type PeriodKey = 'year2026' | 'last3' | 'month' | 'year2025';
export type GroupKey = 'building' | 'none';

export interface LoyersFilters {
  period: PeriodKey;
  lotId: string;
  tenantId: string;
  group: GroupKey;
}

export const LOYERS_DEFAULTS: LoyersFilters = { period: 'year2026', lotId: 'all', tenantId: 'all', group: 'building' };

interface PeriodSpec {
  label: string;
  from: string;
  to: string;
  start: string;
  end: string;
  title: string;
}

export const PERIODS: Record<PeriodKey, PeriodSpec> = {
  year2026: { label: 'Année 2026', from: '2026-01', to: '2026-12', start: '01/01/2026', end: '31/12/2026', title: '2026' },
  last3: { label: '3 derniers mois', from: '2026-09', to: '2026-11', start: '01/09/2026', end: '30/11/2026', title: 'septembre à novembre 2026' },
  month: { label: 'Novembre 2026', from: '2026-11', to: '2026-11', start: '01/11/2026', end: '30/11/2026', title: 'novembre 2026' },
  year2025: { label: 'Année 2025', from: '2025-01', to: '2025-12', start: '01/01/2025', end: '31/12/2025', title: '2025' },
};

export const PERIOD_OPTIONS = (Object.keys(PERIODS) as PeriodKey[]).map((value) => ({ value, label: PERIODS[value].label }));

export const GROUP_OPTIONS: { value: GroupKey; label: string }[] = [
  { value: 'building', label: 'Regrouper par : Immeuble' },
  { value: 'none', label: 'Regrouper par : Aucun' },
];

export interface MonthLine {
  month: string;
  called: number;
  collected: number;
}

export interface LoyerRow {
  lot: LoyerLot;
  months: number;
  called: number;
  collected: number;
  due: number;
  lines: MonthLine[];
}

export interface LoyerGroup {
  key: string;
  label: string | null;
  rows: LoyerRow[];
  called: number;
  collected: number;
  due: number;
}

export interface LoyersTotals {
  called: number;
  collected: number;
  rate: number;
  dueGross: number;
  overpaid: number;
  dueNet: number;
  notices: number;
  payments: number;
  lots: number;
  tenants: number;
  buildings: number;
}

export interface LoyersView {
  period: PeriodSpec;
  groups: LoyerGroup[];
  rows: LoyerRow[];
  totals: LoyersTotals;
  hasData: boolean;
}

const sum = (values: readonly number[]): number => values.reduce((total, value) => total + value, 0);

function buildRow(lot: LoyerLot, spec: PeriodSpec, today: string): LoyerRow | null {
  const last = today.slice(0, 7);
  const paid = new Map(lot.payments.map((payment) => [payment.month, payment.amount]));
  const lines = lot.payments
    .filter((payment) => payment.month >= spec.from && payment.month <= spec.to && payment.month >= lot.startMonth && payment.month <= last)
    .map((payment) => ({ month: payment.month, called: lot.rent, collected: paid.get(payment.month) ?? 0 }));
  if (lines.length === 0) return null;
  const called = sum(lines.map((line) => line.called));
  const collected = sum(lines.map((line) => line.collected));
  return { lot, months: lines.length, called, collected, due: called - collected, lines };
}

export function buildLoyers(data: LoyersData, filters: LoyersFilters): LoyersView {
  const spec = PERIODS[filters.period];
  const rows = data.lots
    .filter((lot) => (filters.lotId === 'all' || lot.id === filters.lotId) && (filters.tenantId === 'all' || lot.tenantId === filters.tenantId))
    .map((lot) => buildRow(lot, spec, data.today))
    .filter((row): row is LoyerRow => row !== null);

  const groupOf = (key: string, label: string | null, members: LoyerRow[]): LoyerGroup => ({
    key,
    label,
    rows: members,
    called: sum(members.map((row) => row.called)),
    collected: sum(members.map((row) => row.collected)),
    due: sum(members.map((row) => row.due)),
  });
  const groups =
    filters.group === 'none'
      ? rows.length > 0 ? [groupOf('all', null, rows)] : []
      : [...new Set(rows.map((row) => row.lot.buildingId))].map((id) => {
          const members = rows.filter((row) => row.lot.buildingId === id);
          return groupOf(id, members[0]?.lot.buildingName ?? id, members);
        });

  const called = sum(rows.map((row) => row.called));
  const collected = sum(rows.map((row) => row.collected));
  return {
    period: spec,
    groups,
    rows,
    totals: {
      called,
      collected,
      rate: ratioPercent(collected, called),
      dueGross: sum(rows.map((row) => Math.max(row.due, 0))),
      overpaid: sum(rows.map((row) => Math.max(-row.due, 0))),
      dueNet: called - collected,
      notices: sum(rows.map((row) => row.months)),
      payments: sum(rows.flatMap((row) => row.lines.map((line) => (line.collected > 0 ? 1 : 0)))),
      lots: rows.length,
      tenants: new Set(rows.map((row) => row.lot.tenantId)).size,
      buildings: new Set(rows.map((row) => row.lot.buildingId)).size,
    },
    hasData: rows.length > 0,
  };
}

export function scopeLabel(data: LoyersData, filters: LoyersFilters): string {
  const lot = data.lots.find((item) => item.id === filters.lotId);
  const tenant = data.lots.find((item) => item.tenantId === filters.tenantId);
  if (lot) return lot.name;
  if (tenant) return tenant.tenantName;
  return 'Tous les biens';
}

export function loyersDataset(view: LoyersView): Dataset {
  const body = view.rows.map((row): Cell[] => [
    row.lot.buildingName,
    row.lot.name,
    row.lot.tenantName,
    row.months,
    { minor: row.called },
    { minor: row.collected },
    { minor: row.due },
  ]);
  const total: Cell[] = ['Total', '', `${String(view.totals.tenants)} locataires`, null, { minor: view.totals.called }, { minor: view.totals.collected }, { minor: view.totals.dueNet }];
  return { columns: ['Immeuble', 'Bien', 'Locataire', 'Mois', 'Appelé', 'Encaissé', 'Reste dû'], rows: [...body, total] };
}

export function encodeFilters(filters: LoyersFilters): string {
  return new URLSearchParams({ periode: filters.period, bien: filters.lotId, locataire: filters.tenantId, groupe: filters.group }).toString();
}

const isPeriod = (value: string | null): value is PeriodKey => value !== null && value in PERIODS;

export const parsePeriod = (value: string | null): PeriodKey => (isPeriod(value) ? value : LOYERS_DEFAULTS.period);

export const parseGroup = (value: string | null): GroupKey => (value === 'none' ? 'none' : 'building');

export function decodeFilters(params: URLSearchParams): LoyersFilters {
  return {
    period: parsePeriod(params.get('periode')),
    lotId: params.get('bien') ?? 'all',
    tenantId: params.get('locataire') ?? 'all',
    group: parseGroup(params.get('groupe')),
  };
}
