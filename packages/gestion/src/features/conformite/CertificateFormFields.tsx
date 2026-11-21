'use client';

import { Select, TextField } from '@eguardimmo/ui';
import { ACCEPT_ATTRIBUTE, ACCEPTED_FORMATS_LABEL, fileProblem } from './files';
import { fieldLabel } from './labels';
import type { CertificateType, ValueField } from './model';
import type { CertificateFormValues, FormErrors } from './validation';
import { FilePicker } from '../locataires/kit';

export const EMPTY_FORM: CertificateFormValues = { reference: '', issuedOn: '', expiresOn: '', values: {}, file: null };

interface Props {
  type: Pick<CertificateType, 'fields' | 'defaultValidityMonths'> | null;
  form: CertificateFormValues;
  errors: FormErrors;
  fileLabel: string;
  onChange: (next: CertificateFormValues) => void;
}

const BOOLEAN_OPTIONS = [
  { value: 'true', label: 'Oui' },
  { value: 'false', label: 'Non' },
];

function ValueFieldInput({ field, value, error, onChange }: { field: ValueField; value: string; error: string | undefined; onChange: (value: string) => void }) {
  const label = `${fieldLabel(field.key)}${field.required ? ' *' : ''}`;
  if (field.options !== null) {
    return <Select label={label} placeholder="Choisir une valeur, ex. C" options={field.options.map((option) => ({ value: option, label: option }))} value={value} onValueChange={onChange} error={error} />;
  }
  if (field.kind === 'boolean') return <Select label={label} placeholder="Oui ou non" options={BOOLEAN_OPTIONS} value={value} onValueChange={onChange} error={error} />;
  const numeric = field.kind === 'integer' || field.kind === 'number';
  return (
    <TextField
      label={label}
      placeholder={field.kind === 'date' ? 'AAAA-MM-JJ' : numeric ? 'Ex. 1500000' : 'Ex. valeur'}
      type={field.kind === 'date' ? 'date' : 'text'}
      inputMode={numeric ? 'numeric' : undefined}
      value={value}
      error={error}
      onChange={(event) => { onChange(event.target.value); }}
    />
  );
}

export function CertificateFormFields({ type, form, errors, fileLabel, onChange }: Props) {
  const patch = (changes: Partial<CertificateFormValues>) => { onChange({ ...form, ...changes }); };
  const expiryHint =
    type === null
      ? undefined
      : type.defaultValidityMonths === null
        ? 'Laissez vide : cette pièce n’a pas d’échéance.'
        : `Laissez vide : l’échéance est calculée (${String(type.defaultValidityMonths)} mois après l’émission).`;
  return (
    <>
      <TextField label="Référence" placeholder="Ex. DPE-2026-001" value={form.reference} error={errors.reference} onChange={(event) => { patch({ reference: event.target.value }); }} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField label="Émise le *" type="date" placeholder="AAAA-MM-JJ" value={form.issuedOn} error={errors.issuedOn} onChange={(event) => { patch({ issuedOn: event.target.value }); }} />
        <TextField label="Échéance" type="date" placeholder="AAAA-MM-JJ" min={form.issuedOn === '' ? undefined : form.issuedOn} value={form.expiresOn} hint={expiryHint} error={errors.expiresOn} onChange={(event) => { patch({ expiresOn: event.target.value }); }} />
      </div>
      {(type?.fields ?? []).map((field) => (
        <ValueFieldInput
          key={field.key}
          field={field}
          value={form.values[field.key] ?? ''}
          error={errors[`values.${field.key}`]}
          onChange={(value) => { patch({ values: { ...form.values, [field.key]: value } }); }}
        />
      ))}
      <FilePicker label={fileLabel} hint={ACCEPTED_FORMATS_LABEL} accept={ACCEPT_ATTRIBUTE} validate={fileProblem} file={form.file} onFile={(file) => { patch({ file }); }} error={errors.file} />
    </>
  );
}
