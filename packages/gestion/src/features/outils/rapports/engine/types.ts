import type { ReportsData } from './data';

export type ColumnKind = 'text' | 'money' | 'cents' | 'int' | 'percent' | 'date';
export type ReportCell = string | number | null;

export interface ReportRow {
  id: string;
  lotId: string | null;
  tenantId: string | null;
  attrs: Readonly<Record<string, string>>;
  cells: readonly ReportCell[];
  tone?: 'danger' | 'warning';
}

export interface ReportColumn {
  id: string;
  label: string;
  kind: ColumnKind;
  total?: 'sum' | ((rows: readonly ReportRow[]) => ReportCell);
}

export interface ReportKpi {
  label: string;
  value: string;
  caption?: string;
  tone?: 'default' | 'danger';
}

export interface GroupOption {
  value: string;
  label: string;
  attr: string | null;
}

export interface PeriodSpec {
  key: string;
  label: string;
  from: string;
  to: string;
  fromDate: string;
  toDate: string;
  start: string;
  end: string;
  title: string;
}

export interface ReportContext {
  data: ReportsData;
  period: PeriodSpec;
  today: string;
}

export interface ReportDefinition {
  slug: string;
  title: string;
  description: string;
  periods: readonly PeriodSpec[] | null;
  filters: { lot: boolean; tenant: boolean };
  groups: readonly GroupOption[];
  columns: readonly ReportColumn[];
  rows: (context: ReportContext) => ReportRow[];
  kpis: (rows: readonly ReportRow[], context: ReportContext) => ReportKpi[];
  note?: string;
  emptyHint: string;
}

export interface ReportFilters {
  period: string;
  lotId: string;
  tenantId: string;
  group: string;
}

export interface ViewGroup {
  key: string;
  label: string | null;
  rows: ReportRow[];
  subtotals: ReportCell[];
}

export interface ReportView {
  definition: ReportDefinition;
  period: PeriodSpec;
  groups: ViewGroup[];
  rows: ReportRow[];
  totals: ReportCell[];
  kpis: ReportKpi[];
  hasData: boolean;
}
