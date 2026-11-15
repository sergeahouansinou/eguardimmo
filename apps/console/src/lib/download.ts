export function downloadTextFile(filename: string, content: string, type = 'text/csv;charset=utf-8'): void {
  const url = URL.createObjectURL(new Blob([`﻿${content}`], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
