'use client';

import { Select } from '@eguardimmo/ui';
import { subjectTypeLabel } from './labels';
import type { CertificateSubject } from './model';
import { CHOOSABLE_SUBJECTS } from './useSubjects';
import type { ChoosableSubject, SubjectChoices } from './useSubjects';

export interface SubjectDraft {
  kind: ChoosableSubject;
  targetId: string;
}

export const EMPTY_SUBJECT: SubjectDraft = { kind: 'organization', targetId: '' };

const kindOptions = CHOOSABLE_SUBJECTS.map((kind) => ({ value: kind, label: subjectTypeLabel[kind] }));

const isChoosable = (value: string): value is ChoosableSubject => CHOOSABLE_SUBJECTS.some((kind) => kind === value);

export function subjectOf(draft: SubjectDraft, organizationId: string | null): CertificateSubject | null {
  if (draft.kind === 'organization') return organizationId === null ? null : { type: 'organization', id: organizationId };
  return draft.targetId === '' ? null : { type: draft.kind, id: draft.targetId };
}

export function SubjectFields({ draft, choices, error, onChange }: { draft: SubjectDraft; choices: SubjectChoices; error: string | undefined; onChange: (next: SubjectDraft) => void }) {
  const options = draft.kind === 'unit' ? choices.unitOptions : choices.leaseOptions;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Select
        label="Concerne *"
        placeholder="Choisir l’objet concerné"
        options={kindOptions}
        value={draft.kind}
        onValueChange={(value) => { if (isChoosable(value)) onChange({ kind: value, targetId: '' }); }}
      />
      {draft.kind === 'organization' ? null : (
        <Select
          label={draft.kind === 'unit' ? 'Lot *' : 'Bail *'}
          placeholder={draft.kind === 'unit' ? 'Choisir un lot, ex. Apt 12' : 'Choisir un bail, ex. BL-2026-0001'}
          options={options}
          value={draft.targetId}
          onValueChange={(value) => { onChange({ ...draft, targetId: value }); }}
          searchable
          searchPlaceholder={draft.kind === 'unit' ? 'Rechercher un lot' : 'Rechercher un bail'}
          error={error}
        />
      )}
    </div>
  );
}
