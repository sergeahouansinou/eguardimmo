'use client';

import { Alert, Card, CardTitle, Checkbox, Select, TextField } from '@eguardimmo/ui';
import type { SelectOption } from '@eguardimmo/ui';
import { LinkButton } from '../../locataires/kit';
import { ACCEPTED_FORMATS_LABEL, ACCEPT_ATTRIBUTE, fileProblem } from '../files';
import { FilePicker } from '../../locataires/kit';
import { libraryKindLabel, librarySubjectLabel } from './labels';
import { LIBRARY_KINDS } from './model';
import type { LibraryKind } from './model';
import { libraryPaths } from './paths';
import { OPTIONAL_SUBJECT_TYPES, REQUIRED_SUBJECT, effectiveSubjectType } from './validation';
import type { LibraryFormErrors, LibraryFormValues, OptionalSubjectType } from './validation';

export interface SubjectOptions {
  units: readonly SelectOption[];
  leases: readonly SelectOption[];
  mandates: readonly SelectOption[];
}

const kindOptions = LIBRARY_KINDS.map((kind) => ({ value: kind, label: libraryKindLabel[kind] }));
const typeOptions = OPTIONAL_SUBJECT_TYPES.map((type) => ({ value: type, label: type === 'none' ? 'Aucun objet' : librarySubjectLabel[type] }));
const isKind = (value: string): value is LibraryKind => LIBRARY_KINDS.some((kind) => kind === value);
const isSubjectType = (value: string): value is OptionalSubjectType => OPTIONAL_SUBJECT_TYPES.some((type) => type === value);

const targetLabel: Readonly<Record<string, { label: string; placeholder: string }>> = {
  unit: { label: 'Lot *', placeholder: 'Choisir un lot, ex. Apt 12' },
  lease: { label: 'Bail *', placeholder: 'Choisir un bail, ex. BL-2026-0001' },
  mandate: { label: 'Mandat *', placeholder: 'Choisir un mandat, ex. M-2026-0012' },
};

export function LibraryFormFields({ form, errors, options, onChange }: { form: LibraryFormValues; errors: LibraryFormErrors; options: SubjectOptions; onChange: (patch: Partial<LibraryFormValues>) => void }) {
  const type = effectiveSubjectType(form);
  const forced = form.kind !== '' && REQUIRED_SUBJECT[form.kind] !== undefined;
  const targets = type === 'unit' ? options.units : type === 'lease' ? options.leases : options.mandates;
  const wording = targetLabel[type];
  return (
    <>
      <Card role="region" aria-labelledby="library-file-title" className="gap-3 px-4 py-3">
        <CardTitle as="h2" id="library-file-title">Document</CardTitle>
        <FilePicker label="Fichier *" hint={ACCEPTED_FORMATS_LABEL} accept={ACCEPT_ATTRIBUTE} validate={fileProblem} file={form.file} onFile={(file) => { onChange({ file }); }} {...(errors.file ? { error: errors.file } : {})} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select
            label="Nature *"
            placeholder="Choisir la nature du document"
            options={kindOptions}
            value={form.kind}
            onValueChange={(value) => { if (isKind(value)) onChange({ kind: value, targetId: '' }); }}
            {...(errors.kind ? { error: errors.kind } : {})}
          />
          <TextField
            label="Nom affiché"
            placeholder="Ex. : Mandat de gestion Dupont"
            hint="Facultatif, 120 caractères au maximum. Par défaut, le nom du fichier."
            autoComplete="off"
            value={form.displayName}
            onChange={(event) => { onChange({ displayName: event.target.value }); }}
            {...(errors.displayName ? { error: errors.displayName } : {})}
          />
        </div>
      </Card>
      <Card role="region" aria-labelledby="library-subject-title" className="gap-3 px-4 py-3">
        <CardTitle as="h2" id="library-subject-title">Rattachement</CardTitle>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {forced ? null : (
            <Select
              label="Concerne"
              placeholder="Choisir l’objet concerné"
              options={typeOptions}
              value={form.subjectType}
              onValueChange={(value) => { if (isSubjectType(value)) onChange({ subjectType: value, targetId: '' }); }}
            />
          )}
          {wording ? (
            <Select
              label={wording.label}
              placeholder={wording.placeholder}
              options={targets}
              value={form.targetId}
              onValueChange={(value) => { onChange({ targetId: value }); }}
              searchable
              searchPlaceholder="Rechercher"
              emptyLabel="Aucun résultat"
              {...(errors.subject ? { error: errors.subject } : {})}
            />
          ) : null}
        </div>
        {form.kind === '' ? <p className="text-caption text-fg-subtle">Un mandat se rattache à un mandat, un bail à un bail ; les autres natures peuvent n’avoir aucun objet.</p> : null}
        {errors.subject && !wording ? <p role="alert" className="text-caption text-fg-danger">{errors.subject}</p> : null}
      </Card>
      <Card role="region" aria-labelledby="library-keep-title" className="gap-3 px-4 py-3">
        <CardTitle as="h2" id="library-keep-title">Conservation et validité</CardTitle>
        <TextField
          label="Conserver jusqu’au"
          type="date"
          placeholder="AAAA-MM-JJ"
          hint="Facultatif. Le document ne pourra pas être supprimé avant cette date."
          value={form.retentionUntil}
          onChange={(event) => { onChange({ retentionUntil: event.target.value }); }}
          {...(errors.retentionUntil ? { error: errors.retentionUntil } : {})}
        />
        <Checkbox label="Ce document a une date de validité (diagnostic, attestation…)" checked={form.hasExpiry} onChange={(event) => { onChange({ hasExpiry: event.target.checked }); }} />
        {form.hasExpiry ? (
          <Alert tone="warning" title="À déposer comme pièce de conformité">
            Un diagnostic ou une pièce de conformité avec une échéance se dépose depuis la conformité : vous recevez ainsi des rappels avant son expiration.
            <span className="mt-2 flex"><LinkButton href={libraryPaths.certificates} size="sm">Ajouter une pièce de conformité</LinkButton></span>
          </Alert>
        ) : null}
      </Card>
    </>
  );
}
