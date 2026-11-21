import { ConformiteApiError } from '../api/conformiteErrors';
import type { LibraryFormErrors } from './validation';

const FIELDS: Readonly<Record<string, { target: keyof LibraryFormErrors; message?: string }>> = {
  file: { target: 'file' },
  kind: { target: 'kind', message: 'Choisissez la nature du document.' },
  subject: { target: 'subject' },
  subject_type: { target: 'subject', message: 'L’objet concerné est invalide.' },
  subject_id: { target: 'subject', message: 'Choisissez l’objet concerné.' },
  display_name: { target: 'displayName', message: '120 caractères au maximum.' },
  retention_until: { target: 'retentionUntil', message: 'La date de conservation doit être postérieure à aujourd’hui (AAAA-MM-JJ).' },
};

export interface LibraryFailure {
  fields: LibraryFormErrors;
  general: string | null;
}

export function libraryFailure(error: unknown): LibraryFailure {
  if (!(error instanceof ConformiteApiError)) return { fields: {}, general: error instanceof Error ? error.message : 'Une erreur est survenue. Réessayez.' };
  const fields: LibraryFormErrors = {};
  for (const [field, text] of Object.entries(error.fieldMessages)) {
    const known = FIELDS[field];
    if (known !== undefined) fields[known.target] = known.message ?? text;
  }
  return { fields, general: Object.keys(fields).length === 0 ? error.message : null };
}
