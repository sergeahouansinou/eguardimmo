const DELIMITERS = [';', ',', '\t'] as const;

export const CSV_MAX_BYTES = 1_000_000;
export const CSV_MAX_ROWS = 500;

function detectDelimiter(header: string): string {
  const counts = DELIMITERS.map((delimiter) => ({ delimiter, count: header.split(delimiter).length - 1 }));
  return counts.reduce((best, current) => (current.count > best.count ? current : best)).delimiter;
}

export function parseDelimited(source: string): string[][] {
  const text = source.replace(/^﻿/, '');
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = detectDelimiter(firstLine);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const endCell = () => {
    row.push(cell.trim());
    cell = '';
  };
  const endRow = () => {
    endCell();
    if (row.some((value) => value !== '')) rows.push(row);
    row = [];
  };
  for (let index = 0; index < text.length; index += 1) {
    const char = text.charAt(index);
    if (quoted) {
      if (char === '"' && text.charAt(index + 1) === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === delimiter) endCell();
    else if (char === '\n') endRow();
    else if (char !== '\r') cell += char;
  }
  endRow();
  return rows;
}

export function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(typeof reader.result === 'string' ? reader.result : '');
    };
    reader.onerror = () => {
      reject(new Error('Le fichier n’a pas pu être lu.'));
    };
    reader.readAsText(file, 'utf-8');
  });
}

export function downloadTextFile(fileName: string, content: string): void {
  const blob = new Blob([`﻿${content}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
