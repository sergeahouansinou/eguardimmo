import type { NewLibraryDocument } from '../model';

export function libraryForm(input: NewLibraryDocument): FormData {
  const form = new FormData();
  form.append('file', input.file);
  form.append('kind', input.kind);
  if (input.subject !== null) {
    form.append('subject_type', input.subject.type);
    form.append('subject_id', input.subject.id);
  }
  const name = input.displayName.trim();
  if (name !== '') form.append('display_name', name);
  if (input.retentionUntil !== '') form.append('retention_until', input.retentionUntil);
  return form;
}
