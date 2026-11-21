import { csvDocument } from '@eguardimmo/shell';

export function toCsv(rows: readonly (readonly string[])[]): string {
  return `﻿${csvDocument(rows)}\r\n`;
}

export function downloadFile(filename: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
