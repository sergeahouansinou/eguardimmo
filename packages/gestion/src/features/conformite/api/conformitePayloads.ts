import { clientRefused } from './conformiteErrors';
import type { CertificateFormValues } from '../validation';
import { validateCertificate, valuesPayload } from '../validation';
import type { CertificateSubject, CertificateType, NewCertificateInput, RenewCertificateInput } from '../model';

const firstError = (errors: Readonly<Record<string, string>>): [string, string] | null => Object.entries(errors)[0] ?? null;

export function ensureValid(form: CertificateFormValues, type: CertificateType | null): void {
  const problem = firstError(validateCertificate(form, type, { fileRequired: false }));
  if (problem !== null) throw clientRefused(problem[0], problem[1]);
}

const optional = (value: string): string | undefined => (value.trim() === '' ? undefined : value.trim());

export function createPayload(input: NewCertificateInput, type: CertificateType, storedFileId: string | null): Record<string, unknown> {
  ensureValid(input, type);
  return {
    subject_type: input.subject.type,
    subject_id: input.subject.id,
    certificate_type_term_id: type.id,
    reference: optional(input.reference),
    issued_on: input.issuedOn,
    expires_on: optional(input.expiresOn),
    values: valuesPayload(type.fields, input.values),
    stored_file_id: storedFileId ?? undefined,
  };
}

export function renewPayload(input: RenewCertificateInput, type: CertificateType, storedFileId: string | null): Record<string, unknown> {
  ensureValid(input, type);
  return {
    reference: optional(input.reference),
    issued_on: input.issuedOn,
    expires_on: optional(input.expiresOn),
    values: valuesPayload(type.fields, input.values),
    stored_file_id: storedFileId ?? undefined,
  };
}

export function uploadForm(file: File, subject: CertificateSubject): FormData {
  const form = new FormData();
  form.append('file', file);
  form.append('category', 'certificate');
  form.append('subject_type', subject.type);
  form.append('subject_id', subject.id);
  return form;
}
