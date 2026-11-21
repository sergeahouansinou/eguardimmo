'use client';

import { Checkbox, Select, Switch, TextField } from '@eguardimmo/ui';
import { CSV_COLUMN_KEYS, CSV_DATE_FORMATS, CSV_DELIMITERS, CSV_ENCODINGS } from './model';
import type { CsvColumnKey } from './model';
import type { CsvDraft, CsvErrors } from './schemas';

const COLUMN_FIELDS: Readonly<Record<CsvColumnKey, { label: string; placeholder: string }>> = {
  booking_date: { label: 'Date de comptabilisation *', placeholder: 'ex. 1 ou Date' },
  value_date: { label: 'Date de valeur', placeholder: 'ex. 2' },
  label: { label: 'Libellé *', placeholder: 'ex. 3 ou Libellé' },
  amount: { label: 'Montant signé', placeholder: 'ex. 4 ou Montant' },
  credit: { label: 'Crédit', placeholder: 'ex. 5' },
  debit: { label: 'Débit', placeholder: 'ex. 6' },
  bank_reference: { label: 'Référence bancaire', placeholder: 'ex. 7' },
  end_to_end_id: { label: 'Référence de bout en bout', placeholder: 'ex. 8' },
  remittance_reference: { label: 'Référence du virement', placeholder: 'ex. 9' },
  counterparty_name: { label: 'Nom de la contrepartie', placeholder: 'ex. 10' },
  counterparty_iban: { label: 'IBAN de la contrepartie', placeholder: 'ex. 11' },
  transaction_code: { label: 'Code opération', placeholder: 'ex. 12' },
};

const DELIMITER_LABEL: Readonly<Record<(typeof CSV_DELIMITERS)[number], string>> = { ';': 'Point-virgule (;)', ',': 'Virgule (,)', '\t': 'Tabulation' };
const DATE_LABEL: Readonly<Record<(typeof CSV_DATE_FORMATS)[number], string>> = { 'd/m/Y': 'jj/mm/aaaa', 'Y-m-d': 'aaaa-mm-jj', 'd-m-Y': 'jj-mm-aaaa', 'd.m.Y': 'jj.mm.aaaa' };

const messageOf = (entry: unknown): string | undefined => (typeof entry === 'object' && entry !== null && 'message' in entry && typeof entry.message === 'string' ? entry.message : undefined);

export function csvErrorsOf(columns: unknown): CsvErrors {
  const result: Partial<Record<CsvColumnKey, string>> = {};
  if (typeof columns !== 'object' || columns === null) return result;
  for (const [name, entry] of Object.entries(columns)) {
    const key = CSV_COLUMN_KEYS.find((candidate) => candidate === name);
    const message = messageOf(entry);
    if (key !== undefined && message !== undefined) result[key] = message;
  }
  return result;
}

function pick<T extends string>(options: readonly T[], value: string, fallback: T): T {
  return options.find((option) => option === value) ?? fallback;
}

export function CsvProfileEditor({ value, onChange, errors, optional = true }: { value: CsvDraft; onChange: (next: CsvDraft) => void; errors: CsvErrors; optional?: boolean }) {
  const set = (patch: Partial<CsvDraft>) => { onChange({ ...value, ...patch }); };
  const setColumn = (key: CsvColumnKey, text: string) => { onChange({ ...value, columns: { ...value.columns, [key]: text } }); };
  return (
    <fieldset className="flex min-w-0 flex-col gap-3 rounded-sm border border-line p-3">
      <legend className="px-1 text-caption text-fg-muted">Profil d’import CSV</legend>
      {optional ? <Switch label="Enregistrer le profil CSV de ce compte" checked={value.enabled} onCheckedChange={(enabled) => { set({ enabled }); }} /> : null}
      {value.enabled ? (
        <>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Select label="Séparateur de colonnes" placeholder="Choisissez" options={CSV_DELIMITERS.map((item) => ({ value: item, label: DELIMITER_LABEL[item] }))} value={value.delimiter} onValueChange={(next) => { set({ delimiter: pick(CSV_DELIMITERS, next, value.delimiter) }); }} />
            <Select label="Encodage du fichier" placeholder="Choisissez" options={CSV_ENCODINGS.map((item) => ({ value: item, label: item }))} value={value.encoding} onValueChange={(next) => { set({ encoding: pick(CSV_ENCODINGS, next, value.encoding) }); }} />
            <Select label="Format des dates" placeholder="Choisissez" options={CSV_DATE_FORMATS.map((item) => ({ value: item, label: DATE_LABEL[item] }))} value={value.dateFormat} onValueChange={(next) => { set({ dateFormat: pick(CSV_DATE_FORMATS, next, value.dateFormat) }); }} />
            <Select label="Séparateur décimal" placeholder="Choisissez" options={[{ value: ',', label: 'Virgule (12,50)' }, { value: '.', label: 'Point (12.50)' }]} value={value.decimalSeparator} onValueChange={(next) => { set({ decimalSeparator: next === '.' ? '.' : ',' }); }} />
            <Select label="Séparateur de milliers" placeholder="Choisissez" options={[{ value: '', label: 'Aucun ou espace' }, { value: '.', label: 'Point (1.250,50)' }, { value: ',', label: 'Virgule (1,250.50)' }]} value={value.thousandsSeparator} onValueChange={(next) => { set({ thousandsSeparator: next === '.' || next === ',' ? next : '' }); }} />
          </div>
          <Checkbox label="La première ligne contient les titres de colonnes" checked={value.hasHeader} onChange={(event) => { set({ hasHeader: event.target.checked }); }} />
          <p className="text-caption text-fg-subtle">Indiquez pour chaque donnée son numéro de colonne (1, 2, 3…) ou son titre exact. Renseignez le montant signé, ou bien les colonnes crédit et débit.</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {CSV_COLUMN_KEYS.map((key) => (
              <TextField key={key} label={COLUMN_FIELDS[key].label} placeholder={COLUMN_FIELDS[key].placeholder} value={value.columns[key]} error={errors[key]} onChange={(event) => { setColumn(key, event.target.value); }} />
            ))}
          </div>
        </>
      ) : null}
    </fieldset>
  );
}
