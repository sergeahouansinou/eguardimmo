import type { Dataset } from '../../analytique/csv';
import type { ReportsData } from './data';
import { SNAPSHOT_PERIOD } from './periods';
import { toCsvCell } from './format';
import type { ColumnKind, GroupOption, PeriodSpec, ReportCell, ReportColumn, ReportDefinition, ReportFilters, ReportRow, ReportView, ViewGroup } from './types';

export const ALL = 'all';

export function defaultFilters(definition: ReportDefinition): ReportFilters {
  return { period: definition.periods?.[0]?.key ?? SNAPSHOT_PERIOD.key, lotId: ALL, tenantId: ALL, group: definition.groups[0]?.value ?? 'none' };
}

export function periodOf(definition: ReportDefinition, key: string): PeriodSpec {
  return definition.periods?.find((period) => period.key === key) ?? definition.periods?.[0] ?? SNAPSHOT_PERIOD;
}

export const numberAt = (row: ReportRow, index: number): number => {
  const cell = row.cells[index];
  return typeof cell === 'number' ? cell : 0;
};

export const sumAt = (rows: readonly ReportRow[], index: number): number => rows.reduce((total, row) => total + numberAt(row, index), 0);

export function indexOfColumns<const T extends readonly ReportColumn[]>(columns: T): (id: T[number]['id']) => number {
  return (id) => {
    const index = columns.findIndex((column) => column.id === id);
    if (index < 0) throw new RangeError(`Colonne inconnue : ${id}`);
    return index;
  };
}

function totalsOf(columns: readonly ReportColumn[], rows: readonly ReportRow[], withFunctions: boolean): ReportCell[] {
  return columns.map((column, index) => {
    if (column.total === 'sum') return sumAt(rows, index);
    if (typeof column.total === 'function' && withFunctions) return column.total(rows);
    return null;
  });
}

function groupRows(definition: ReportDefinition, rows: ReportRow[], filters: ReportFilters): ViewGroup[] {
  const option: GroupOption | undefined = definition.groups.find((item) => item.value === filters.group);
  const attr = option?.attr ?? null;
  if (rows.length === 0) return [];
  if (attr === null) return [{ key: ALL, label: null, rows, subtotals: totalsOf(definition.columns, rows, false) }];
  const keys = [...new Set(rows.map((row) => row.attrs[attr] ?? 'Autres'))];
  return keys.map((key) => {
    const members = rows.filter((row) => (row.attrs[attr] ?? 'Autres') === key);
    return { key, label: key, rows: members, subtotals: totalsOf(definition.columns, members, false) };
  });
}

export function buildReport(definition: ReportDefinition, data: ReportsData, filters: ReportFilters): ReportView {
  const period = periodOf(definition, filters.period);
  const context = { data, period, today: data.today };
  const rows = definition
    .rows(context)
    .filter((row) => (!definition.filters.lot || filters.lotId === ALL || row.lotId === filters.lotId) && (!definition.filters.tenant || filters.tenantId === ALL || row.tenantId === filters.tenantId));
  return {
    definition,
    period,
    groups: groupRows(definition, rows, filters),
    rows,
    totals: totalsOf(definition.columns, rows, true),
    kpis: rows.length > 0 ? definition.kpis(rows, context) : [],
    hasData: rows.length > 0,
  };
}

const isZeroRow = (definition: ReportDefinition, row: ReportRow): boolean =>
  definition.columns.every((column, index) => column.total !== 'sum' || numberAt(row, index) === 0);

export function withoutZeroRows(view: ReportView): ReportView {
  const rows = view.rows.filter((row) => !isZeroRow(view.definition, row));
  return { ...view, rows, hasData: rows.length > 0, groups: view.groups.map((group) => ({ ...group, rows: group.rows.filter((row) => !isZeroRow(view.definition, row)) })).filter((group) => group.rows.length > 0) };
}

export const hasSummedColumns = (definition: ReportDefinition): boolean => definition.columns.some((column) => column.total === 'sum');

export function reportDataset(view: ReportView): Dataset {
  const { columns } = view.definition;
  const body = view.rows.map((row) => row.cells.map((cell, index) => toCsvCell(columns[index]?.kind ?? 'text', cell)));
  const total = view.totals.map((cell, index) => (index === 0 ? 'Total' : toCsvCell(columns[index]?.kind ?? 'text', cell)));
  const hasTotals = view.totals.some((cell) => cell !== null);
  return { columns: columns.map((column) => column.label), rows: hasTotals ? [...body, total] : body };
}

export function encodeReportFilters(filters: ReportFilters): string {
  return new URLSearchParams({ periode: filters.period, bien: filters.lotId, locataire: filters.tenantId, groupe: filters.group }).toString();
}

export function decodeReportFilters(definition: ReportDefinition, params: URLSearchParams): ReportFilters {
  const base = defaultFilters(definition);
  const period = params.get('periode');
  const group = params.get('groupe');
  return {
    period: definition.periods?.some((item) => item.key === period) && period !== null ? period : base.period,
    lotId: params.get('bien') ?? ALL,
    tenantId: params.get('locataire') ?? ALL,
    group: definition.groups.some((item) => item.value === group) && group !== null ? group : base.group,
  };
}

export function scopeOf(definition: ReportDefinition, data: ReportsData, filters: ReportFilters): string {
  const lot = definition.filters.lot ? data.lots.find((item) => item.id === filters.lotId) : undefined;
  if (lot) return lot.name;
  const tenant = definition.filters.tenant ? data.leases.find((item) => item.tenantId === filters.tenantId) : undefined;
  return tenant ? tenant.tenantName : 'Tous les biens';
}

export const columnKindOf = (definition: ReportDefinition, index: number): ColumnKind => definition.columns[index]?.kind ?? 'text';
