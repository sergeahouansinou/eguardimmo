import { formatDateFr, formatDecimal, formatEuros, formatPercentValue, formatRoundedEuros } from '../../analytique/format';
import type { Cell } from '../../analytique/csv';
import type { ColumnKind, ReportCell } from './types';

export function formatReportCell(kind: ColumnKind, cell: ReportCell): string {
  if (cell === null) return '';
  if (typeof cell === 'string') return kind === 'date' ? formatDateFr(cell) : cell;
  if (kind === 'money') return formatRoundedEuros(cell);
  if (kind === 'cents') return formatEuros(cell);
  if (kind === 'percent') return formatPercentValue(cell);
  return formatDecimal(cell, 0);
}

export function toCsvCell(kind: ColumnKind, cell: ReportCell): Cell {
  if (cell === null) return null;
  if (typeof cell === 'string') return kind === 'date' ? formatDateFr(cell) : cell;
  return kind === 'money' || kind === 'cents' ? { minor: cell } : cell;
}
