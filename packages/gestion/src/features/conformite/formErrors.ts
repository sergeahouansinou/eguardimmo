import { ConformiteApiError } from './api/conformiteErrors';

const FORM_FIELD: Readonly<Record<string, string>> = {
  issued_on: 'issuedOn',
  expires_on: 'expiresOn',
  reference: 'reference',
  file: 'file',
  stored_file_id: 'file',
  certificate_type_term_id: 'typeId',
  subject_id: 'subject',
  subject_type: 'subject',
};

export interface FormFailure {
  fields: Readonly<Record<string, string>>;
  general: string | null;
}

export function formFailure(error: unknown): FormFailure {
  if (!(error instanceof ConformiteApiError)) return { fields: {}, general: error instanceof Error ? error.message : 'Une erreur est survenue. Réessayez.' };
  const fields: Record<string, string> = {};
  for (const [field, message] of Object.entries(error.fieldMessages)) {
    const target = field.startsWith('values.') ? field : FORM_FIELD[field];
    if (target !== undefined) fields[target] = message;
  }
  return { fields, general: Object.keys(fields).length === 0 ? error.message : null };
}
