import { csvDocument } from '@eguardimmo/shell';
import type { CsvCell } from '@eguardimmo/shell';

export type { CsvCell };

export function toCsv(rows: readonly (readonly CsvCell[])[]): string {
  return csvDocument(rows);
}

export function downloadCsv(filename: string, rows: readonly (readonly CsvCell[])[]): void {
  saveBlob(filename, new Blob([`﻿${toCsv(rows)}`], { type: 'text/csv;charset=utf-8' }));
}

export function downloadText(filename: string, text: string): void {
  saveBlob(filename, new Blob([text], { type: 'text/plain;charset=utf-8' }));
}

function saveBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function parseCsv(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.split(';').map((cell) => cell.trim().replace(/^"|"$/g, '')));
}
