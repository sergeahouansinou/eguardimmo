import { formatMoney } from '../../../format/money';

export type Cell = string | number | { minor: number } | null;

export interface Dataset {
  columns: readonly string[];
  rows: readonly (readonly Cell[])[];
}

const SEPARATOR = ';';
const BOM = '﻿';
const FORMULA_START = /^[=+\-@\t\r]/;

function decimal(value: number, digits: number): string {
  return value.toFixed(digits).replace('.', ',');
}

function csvCell(cell: Cell): string {
  if (cell === null) return '';
  if (typeof cell === 'number') return decimal(cell, Number.isInteger(cell) ? 0 : 2);
  if (typeof cell === 'object') return decimal(cell.minor / 100, 2);
  const safe = FORMULA_START.test(cell) ? `'${cell}` : cell;
  return /[";\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function buildCsv(dataset: Dataset): string {
  const lines = [dataset.columns.map((column) => csvCell(column)), ...dataset.rows.map((row) => row.map(csvCell))];
  return `${BOM}${lines.map((line) => line.join(SEPARATOR)).join('\r\n')}\r\n`;
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
