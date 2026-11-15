export interface UploadRules {
  maxBytes: number;
  mimeTypes: readonly string[];
  extensions: readonly string[];
  label: string;
}

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const PHOTO_RULES: UploadRules = {
  maxBytes: MAX_UPLOAD_BYTES,
  mimeTypes: ['image/jpeg', 'image/png'],
  extensions: ['jpg', 'jpeg', 'png'],
  label: 'JPG ou PNG, 10 Mo au maximum',
};

export const ATTESTATION_RULES: UploadRules = {
  maxBytes: MAX_UPLOAD_BYTES,
  mimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
  extensions: ['pdf', 'jpg', 'jpeg', 'png'],
  label: 'PDF ou image, 10 Mo au maximum',
};

export const AVATAR_RULES: UploadRules = {
  maxBytes: 5 * 1024 * 1024,
  mimeTypes: ['image/jpeg', 'image/png'],
  extensions: ['jpg', 'jpeg', 'png'],
  label: 'JPG ou PNG, 5 Mo au maximum',
};

export interface FileCheck {
  ok: boolean;
  error?: string;
}

export function checkFile(file: Pick<File, 'name' | 'size' | 'type'>, rules: UploadRules): FileCheck {
  const extension = file.name.split('.').at(-1)?.toLowerCase() ?? '';
  if (file.size === 0) return { ok: false, error: `« ${file.name} » est vide.` };
  if (file.size > rules.maxBytes) {
    return { ok: false, error: `« ${file.name} » dépasse ${String(Math.round(rules.maxBytes / 1_048_576))} Mo.` };
  }
  if (!rules.mimeTypes.includes(file.type) || !rules.extensions.includes(extension)) {
    return { ok: false, error: `« ${file.name} » n'est pas d'un format accepté (${rules.label}).` };
  }
  return { ok: true };
}
