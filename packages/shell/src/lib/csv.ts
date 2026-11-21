const FORMULA_START = /^[=+\-@\t\r]/;
const PLAIN_NUMBER = /^-?\d+(?:[.,]\d+)?$/;
const NEEDS_QUOTES = /[";\r\n]/;

export type CsvCell = string | number | null | undefined;

export function csvCell(cell: CsvCell): string {
  if (cell === null || cell === undefined) return '';
  const text = String(cell);
  const safe = typeof cell === 'string' && FORMULA_START.test(text) && !PLAIN_NUMBER.test(text) ? `'${text}` : text;
  return NEEDS_QUOTES.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export function csvLine(cells: readonly CsvCell[]): string {
  return cells.map(csvCell).join(';');
}

export function csvDocument(rows: readonly (readonly CsvCell[])[]): string {
  return rows.map(csvLine).join('\r\n');
}
