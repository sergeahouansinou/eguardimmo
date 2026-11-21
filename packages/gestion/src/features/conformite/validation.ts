import { fileProblem } from './files';
import type { CertificateType, CertificateValues, ValueField } from './model';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const INTEGER_PATTERN = /^-?\d{1,15}$/;
const NUMBER_PATTERN = /^-?\d{1,15}(\.\d{1,6})?$/;
const MAX_REFERENCE = 120;

export function isIsoDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export interface CertificateFormValues {
  reference: string;
  issuedOn: string;
  expiresOn: string;
  values: CertificateValues;
  file: File | null;
}

export type FormErrors = Readonly<Record<string, string>>;

function fieldProblem(field: ValueField, raw: string): string | null {
  const value = raw.trim();
  if (value === '') return field.required ? 'Ce champ est obligatoire.' : null;
  if (field.options !== null && !field.options.includes(value)) return 'Choisissez une valeur de la liste.';
  if (field.kind === 'integer' || field.kind === 'number') {
    if (!(field.kind === 'integer' ? INTEGER_PATTERN : NUMBER_PATTERN).test(value)) return field.kind === 'integer' ? 'Saisissez un nombre entier.' : 'Saisissez un nombre.';
    const amount = Number(value);
    if (field.min !== null && amount < field.min) return `La valeur minimale est ${String(field.min)}.`;
    if (field.max !== null && amount > field.max) return `La valeur maximale est ${String(field.max)}.`;
  }
  if (field.kind === 'boolean' && value !== 'true' && value !== 'false') return 'Choisissez oui ou non.';
  if (field.kind === 'date' && !isIsoDate(value)) return 'Saisissez une date valide (AAAA-MM-JJ).';
  if (field.kind === 'string' && value.length > 500) return '500 caractères au plus.';
  return null;
}

export function validateCertificate(form: CertificateFormValues, type: Pick<CertificateType, 'fields'> | null, options: { fileRequired: boolean }): FormErrors {
  const errors: Record<string, string> = {};
  if (type === null) errors.typeId = 'Choisissez le type de pièce.';
  if (form.reference.trim().length > MAX_REFERENCE) errors.reference = 'La référence est trop longue (120 caractères au plus).';
  if (!isIsoDate(form.issuedOn)) errors.issuedOn = 'Saisissez la date d’émission (AAAA-MM-JJ).';
  if (form.expiresOn !== '') {
    if (!isIsoDate(form.expiresOn)) errors.expiresOn = 'Saisissez une date d’échéance valide (AAAA-MM-JJ).';
    else if (isIsoDate(form.issuedOn) && form.expiresOn < form.issuedOn) errors.expiresOn = 'L’échéance ne peut pas précéder la date d’émission.';
  }
  for (const field of type?.fields ?? []) {
    const problem = fieldProblem(field, form.values[field.key] ?? '');
    if (problem !== null) errors[`values.${field.key}`] = problem;
  }
  if (form.file !== null) {
    const problem = fileProblem(form.file);
    if (problem !== null) errors.file = problem;
  } else if (options.fileRequired) {
    errors.file = 'Joignez le justificatif de la pièce.';
  }
  return errors;
}

export function valuesPayload(fields: readonly ValueField[], raw: CertificateValues): Record<string, string | number | boolean> {
  const values: Record<string, string | number | boolean> = {};
  for (const field of fields) {
    const text = (raw[field.key] ?? '').trim();
    if (text === '') continue;
    if (field.kind === 'integer' || field.kind === 'number') values[field.key] = Number(text);
    else if (field.kind === 'boolean') values[field.key] = text === 'true';
    else values[field.key] = text;
  }
  return values;
}
