import { csvDocument } from "@eguardimmo/shell";

export function toCsv(header: readonly string[], rows: readonly (readonly string[])[]): string {
  return csvDocument([header, ...rows]);
}

export function downloadCsv(filename: string, content: string): void {
  const url = URL.createObjectURL(new Blob([`﻿${content}`], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
