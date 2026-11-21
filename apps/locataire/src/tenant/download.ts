export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const COMBINING_MARKS = /[\u0300-\u036f]/g;
const UNSAFE_CHARACTERS = /[^A-Za-z0-9._-]+/g;

export const safeFileName = (name: string): string => name.normalize('NFD').replace(COMBINING_MARKS, '').replace(UNSAFE_CHARACTERS, '-');

export const pdfFilename = (name: string): string => `${safeFileName(name)}.pdf`;
