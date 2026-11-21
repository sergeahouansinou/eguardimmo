import { csvDocument } from '@eguardimmo/shell';
import { formatMoney } from '../../../format/money';

export type Cell = string | number | { minor: number } | null;

export interface Dataset {
  columns: readonly string[];
  rows: readonly (readonly Cell[])[];
}

const BOM = '﻿';

function decimal(value: number, digits: number): string {
  return value.toFixed(digits).replace('.', ',');
}

function plainCell(cell: Cell): string {
  if (cell === null) return '';
  if (typeof cell === 'number') return decimal(cell, Number.isInteger(cell) ? 0 : 2);
  if (typeof cell === 'object') return decimal(cell.minor / 100, 2);
  return cell;
}

export function buildCsv(dataset: Dataset): string {
  return `${BOM}${csvDocument([dataset.columns, ...dataset.rows.map((row) => row.map(plainCell))])}\r\n`;
}

export function downloadCsv(filename: string, dataset: Dataset): void {
  const blob = new Blob([buildCsv(dataset)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function displayCell(cell: Cell): string {
  if (cell === null) return '';
  if (typeof cell === 'string') return cell;
  if (typeof cell === 'number') return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(cell);
  return formatMoney(cell.minor, 'EUR');
}
