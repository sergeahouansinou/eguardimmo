import { z } from 'zod';
import { CSV_MAX_ROWS, parseDelimited } from '../suivi/shared/csv';
import { fold } from '../suivi/shared/text';
import { MAX_IMPORT_ROWS } from './model';
import type { ContactKind, ImportRow } from './model';

export const CONTACT_CSV_HEADER = ['Type', 'Nom', 'Prénom', 'Société', 'E-mail', 'Téléphone', 'Interlocuteur', 'Notes'] as const;

export const CONTACT_CSV_TEMPLATE = [
  CONTACT_CSV_HEADER.join(';'),
  'Société;;;Plomberie Sanvi;contact@plomberie-sanvi.fr;+33 6 12 40 18 77;Rodrigue Sanvi;Intervient sous 48 h',
  'Personne;Dubois;Camille;;camille.dubois@exemple.fr;;;',
].join('\r\n');

export interface ImportCandidate {
  line: number;
  label: string;
  row: ImportRow;
}

export interface RejectedLine {
  line: number;
  reasons: string[];
}

export interface ContactCsvReport {
  accepted: ImportCandidate[];
  rejected: RejectedLine[];
  fatal: string | null;
}

type ColumnKey = 'type' | 'lastName' | 'firstName' | 'company' | 'email' | 'phone' | 'label' | 'note';

const COLUMN_KEYS: Record<string, ColumnKey> = {
  type: 'type',
  nom: 'lastName',
  prenom: 'firstName',
  societe: 'company',
  raisonsociale: 'company',
  entreprise: 'company',
  email: 'email',
  courriel: 'email',
  mail: 'email',
  telephone: 'phone',
  tel: 'phone',
  interlocuteur: 'label',
  note: 'note',
  notes: 'note',
};

const COMPANY_WORDS = ['societe', 'entreprise', 'company', 'organisation', 'sarl', 'sas'];
const PERSON_WORDS = ['personne', 'person', 'particulier', 'individu'];
const NO_ANGLE_BRACKETS = /^[^<>]*$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NO_FORMULA_START = /^(?![=+\-@])/;
const PHONE = /^(?:[+(\d][\d\s().\-/]*)?$/;
const PHONE_MAX = 32;

const formulaMessage = (label: string): string => `${label} : une valeur ne peut pas commencer par =, +, - ou @ (formule de tableur).`;

const cellSchema = (label: string, max: number) =>
  z
    .string()
    .max(max, `${label} : ${String(max)} caractères au plus.`)
    .regex(NO_ANGLE_BRACKETS, `${label} : les caractères < et > ne sont pas autorisés.`)
    .regex(NO_FORMULA_START, formulaMessage(label));

const lineSchema = z
  .object({
    kind: z.enum(['person', 'company']),
    lastName: cellSchema('Nom', 120),
    firstName: cellSchema('Prénom', 120),
    company: cellSchema('Société', 200),
    email: z
      .string()
      .max(254, 'E-mail : 254 caractères au plus.')
      .regex(NO_FORMULA_START, formulaMessage('E-mail'))
      .refine((value) => value === '' || EMAIL.test(value), 'E-mail invalide.'),
    phone: z
      .string()
      .max(PHONE_MAX, `Téléphone : ${String(PHONE_MAX)} caractères au plus.`)
      .regex(PHONE, 'Téléphone : seuls les chiffres, espaces et + ( ) . - / sont autorisés, en commençant par un chiffre, + ou (.'),
    label: cellSchema('Interlocuteur', 60),
    note: z
      .string()
      .max(500, 'Notes : 500 caractères au plus.')
      .regex(NO_ANGLE_BRACKETS, 'Notes : les caractères < et > ne sont pas autorisés.')
      .regex(NO_FORMULA_START, formulaMessage('Notes')),
  })
  .check((context) => {
    const { value } = context;
    if (value.kind === 'person' && value.lastName === '') context.issues.push({ code: 'custom', message: 'Le nom est obligatoire pour une personne.', input: value });
    if (value.kind === 'company' && value.company === '') context.issues.push({ code: 'custom', message: 'La raison sociale est obligatoire pour une société.', input: value });
  });

function kindOf(typeCell: string, company: string): { kind: ContactKind } | { error: string } {
  const needle = fold(typeCell).replace(/[^a-z]/g, '');
  if (needle === '') return { kind: company !== '' ? 'company' : 'person' };
  if (COMPANY_WORDS.includes(needle)) return { kind: 'company' };
  if (PERSON_WORDS.includes(needle)) return { kind: 'person' };
  return { error: `Type inconnu : « ${typeCell} », attendu Personne ou Société.` };
}

function toRow(value: z.output<typeof lineSchema>): ImportRow {
  const label = value.label === '' ? null : value.label;
  const points = [
    ...(value.email === '' ? [] : [{ type: 'email', value: value.email, label, primary: true }]),
    ...(value.phone === '' ? [] : [{ type: 'phone', value: value.phone, label, primary: true }]),
  ];
  return {
    kind: value.kind,
    ...(value.kind === 'person' ? { last_name: value.lastName, ...(value.firstName === '' ? {} : { first_name: value.firstName }) } : { company_name: value.company }),
    ...(value.note === '' ? {} : { note: value.note }),
    ...(points.length === 0 ? {} : { contact_points: points }),
  };
}

export function parseContactsCsv(text: string): ContactCsvReport {
  const [header, ...body] = parseDelimited(text);
  if (!header) return { accepted: [], rejected: [], fatal: 'Le fichier est vide.' };
  const columns = new Map<ColumnKey, number>();
  header.forEach((title, position) => {
    const key = COLUMN_KEYS[fold(title).replace(/[^a-z]/g, '')];
    if (key && !columns.has(key)) columns.set(key, position);
  });
  if (!columns.has('lastName') && !columns.has('company')) return { accepted: [], rejected: [], fatal: 'Une colonne « Nom » ou « Société » est obligatoire en première ligne.' };
  if (body.length === 0) return { accepted: [], rejected: [], fatal: 'Le fichier ne contient aucun contact.' };
  if (body.length > Math.min(CSV_MAX_ROWS, MAX_IMPORT_ROWS)) return { accepted: [], rejected: [], fatal: `Le fichier dépasse ${String(MAX_IMPORT_ROWS)} lignes : découpez-le en plusieurs fichiers.` };

  const accepted: ImportCandidate[] = [];
  const rejected: RejectedLine[] = [];
  body.forEach((cells, offset) => {
    const line = offset + 2;
    const cell = (key: ColumnKey): string => {
      const position = columns.get(key);
      return position === undefined ? '' : (cells[position] ?? '').trim();
    };
    const resolved = kindOf(cell('type'), cell('company'));
    if ('error' in resolved) {
      rejected.push({ line, reasons: [resolved.error] });
      return;
    }
    const parsed = lineSchema.safeParse({
      kind: resolved.kind,
      lastName: cell('lastName'),
      firstName: cell('firstName'),
      company: resolved.kind === 'company' && cell('company') === '' ? cell('lastName') : cell('company'),
      email: cell('email'),
      phone: cell('phone'),
      label: cell('label'),
      note: cell('note'),
    });
    if (!parsed.success) {
      rejected.push({ line, reasons: [...new Set(parsed.error.issues.map((issue) => issue.message))] });
      return;
    }
    const value = parsed.data;
    const name = value.kind === 'company' ? value.company : [value.firstName, value.lastName].filter((part) => part !== '').join(' ');
    accepted.push({ line, label: name, row: toRow(value) });
  });
  return { accepted, rejected, fatal: null };
}
