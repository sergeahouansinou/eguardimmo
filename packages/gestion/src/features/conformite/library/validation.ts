import { z } from 'zod';
import { LIBRARY_KINDS } from './model';
import type { LibraryKind, LibrarySubject, NewLibraryDocument } from './model';

export const OPTIONAL_SUBJECT_TYPES = ['none', 'organization', 'unit', 'lease', 'mandate'] as const;
export type OptionalSubjectType = (typeof OPTIONAL_SUBJECT_TYPES)[number];

export interface LibraryFormValues {
  kind: LibraryKind | '';
  subjectType: OptionalSubjectType;
  targetId: string;
  displayName: string;
  retentionUntil: string;
  hasExpiry: boolean;
  file: File | null;
}

export const EMPTY_LIBRARY_FORM: LibraryFormValues = { kind: '', subjectType: 'none', targetId: '', displayName: '', retentionUntil: '', hasExpiry: false, file: null };

export type LibraryFormErrors = Partial<Record<'kind' | 'subject' | 'displayName' | 'retentionUntil' | 'file' | 'expiry', string>>;

export const REQUIRED_SUBJECT: Readonly<Partial<Record<LibraryKind, OptionalSubjectType>>> = { mandate: 'mandate', lease: 'lease' };

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)));

export const displayNameSchema = z.string().trim().max(120, '120 caractères au maximum.');
export const kindSchema = z.enum(LIBRARY_KINDS, 'Choisissez la nature du document.');

export function effectiveSubjectType(form: Pick<LibraryFormValues, 'kind' | 'subjectType'>): OptionalSubjectType {
  return (form.kind === '' ? undefined : REQUIRED_SUBJECT[form.kind]) ?? form.subjectType;
}

export function subjectOf(form: LibraryFormValues, organizationId: string | null): LibrarySubject | null {
  const type = effectiveSubjectType(form);
  if (type === 'none') return null;
  if (type === 'organization') return organizationId === null ? null : { type, id: organizationId };
  return form.targetId === '' ? null : { type, id: form.targetId };
}

export function validateLibraryForm(form: LibraryFormValues, organizationId: string | null, today: string): LibraryFormErrors {
  const errors: LibraryFormErrors = {};
  if (!kindSchema.safeParse(form.kind).success) errors.kind = 'Choisissez la nature du document.';
  const name = displayNameSchema.safeParse(form.displayName);
  if (!name.success) errors.displayName = name.error.issues[0]?.message ?? 'Nom invalide.';
  if (form.file === null) errors.file = 'Choisissez le fichier à déposer.';
  const type = effectiveSubjectType(form);
  if (type !== 'none' && subjectOf(form, organizationId) === null) errors.subject = type === 'organization' ? 'Aucune agence n’est sélectionnée.' : 'Choisissez l’objet concerné.';
  if (form.retentionUntil !== '') {
    if (!isoDate.safeParse(form.retentionUntil).success) errors.retentionUntil = 'Saisissez une date valide, par exemple 2031-12-31.';
    else if (form.retentionUntil <= today) errors.retentionUntil = 'La date de conservation doit être postérieure à aujourd’hui.';
  }
  if (form.hasExpiry) errors.expiry = 'Un document avec une date de validité se dépose comme pièce de conformité.';
  return errors;
}

export function toNewDocument(form: LibraryFormValues, organizationId: string | null): NewLibraryDocument | null {
  const kind = kindSchema.safeParse(form.kind);
  if (!kind.success || form.file === null) return null;
  return { file: form.file, kind: kind.data, subject: subjectOf(form, organizationId), displayName: form.displayName, retentionUntil: form.retentionUntil };
}
