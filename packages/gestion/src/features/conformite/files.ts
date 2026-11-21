export const MAX_FILE_BYTES = 10 * 1024 * 1024;

const EXTENSIONS: Readonly<Record<string, string>> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const ACCEPTED_MIME_TYPES: readonly string[] = Object.keys(EXTENSIONS);
export const ACCEPT_ATTRIBUTE = ACCEPTED_MIME_TYPES.join(',');
export const ACCEPTED_FORMATS_LABEL = 'PDF, JPEG, PNG ou WebP, 10 Mo au plus';

export function fileProblem(file: Pick<File, 'type' | 'size'>): string | null {
  if (!ACCEPTED_MIME_TYPES.includes(file.type)) return `Ce type de fichier n’est pas accepté (${ACCEPTED_FORMATS_LABEL}).`;
  if (file.size === 0) return 'Ce fichier est vide.';
  if (file.size > MAX_FILE_BYTES) return 'Ce fichier dépasse 10 Mo.';
  return null;
}

export const extensionOf = (mimeType: string): string => EXTENSIONS[mimeType.split(';')[0]?.trim().toLowerCase() ?? ''] ?? 'bin';

export function downloadName(parts: readonly (string | null | undefined)[], mimeType: string): string {
  const base = parts
    .filter((part): part is string => typeof part === 'string' && part.trim() !== '')
    .join('-')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return `${base === '' ? 'piece' : base}.${extensionOf(mimeType)}`;
}
