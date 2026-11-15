import { findImportClash } from './leaseRules';
import type { StagedLease } from './leaseRules';
import { MAX_LEASE_IMPORT_ROWS, importedLeaseFields, leaseImportRowSchema } from './leaseImportSchema';
import type { LeaseImportRow } from './leaseImportSchema';
import type { Lease } from './schemas';
import { formatDateFr } from '../locataires/kit/dates';
import { slugify } from '../locataires/kit/ids';

export const LEASE_IMPORT_HEADERS = ['Bien', 'Locataire', 'Début', 'Fin', 'Loyer', 'Charges', 'Dépôt', 'Type'] as const;
const REQUIRED_COLUMNS = 7;

export interface LeaseImportUnit {
  id: string;
  label: string;
  building: string;
}

export interface LeaseImportTenant {
  id: string;
  name: string;
}

export interface LeaseImportRejection {
  line: number;
  reason: string;
}

export interface LeaseImportReport {
  accepted: { line: number; input: LeaseImportRow }[];
  rejected: LeaseImportRejection[];
}

const fold = (text: string): string => slugify(text);

function splitLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line.charAt(index);
    if (quoted) {
      if (char === '"' && line.charAt(index + 1) === '"') {
        current += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else current += char;
    } else if (char === '"') quoted = true;
    else if (char === ';') {
      cells.push(current.trim());
      current = '';
    } else current += char;
  }
  cells.push(current.trim());
  return cells;
}

function isoOf(text: string): string {
  const french = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  return french ? `${french[3] ?? ''}-${french[2] ?? ''}-${french[1] ?? ''}` : text;
}

function furnishedOf(text: string): boolean | undefined {
  const key = fold(text);
  if (key === '' || key === 'vide') return false;
  if (key === 'meuble') return true;
  return undefined;
}

export function parseLeasesCsv(
  text: string,
  units: readonly LeaseImportUnit[],
  tenants: readonly LeaseImportTenant[],
  existing: readonly Lease[],
  today: string,
): LeaseImportReport {
  const report: LeaseImportReport = { accepted: [], rejected: [] };
  const lines = text
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .map((raw, index) => ({ raw, line: index + 1 }))
    .filter((entry) => entry.raw.trim() !== '');
  const [header, ...rows] = lines;
  if (!header) {
    report.rejected.push({ line: 1, reason: 'Le fichier est vide.' });
    return report;
  }
  const columns = splitLine(header.raw).map(fold);
  const expected = LEASE_IMPORT_HEADERS.slice(0, REQUIRED_COLUMNS).map(fold);
  if (!expected.every((name, index) => columns[index] === name)) {
    report.rejected.push({ line: header.line, reason: `En-tête invalide : attendu ${LEASE_IMPORT_HEADERS.join(';')}.` });
    return report;
  }
  if (rows.length > MAX_LEASE_IMPORT_ROWS) {
    report.rejected.push({ line: rows[MAX_LEASE_IMPORT_ROWS]?.line ?? 0, reason: `Le fichier dépasse ${String(MAX_LEASE_IMPORT_ROWS)} baux.` });
    return report;
  }
  const staged: StagedLease[] = [];
  for (const { raw, line } of rows) {
    const cells = splitLine(raw);
    if (cells.length < REQUIRED_COLUMNS || cells.length > LEASE_IMPORT_HEADERS.length) {
      report.rejected.push({ line, reason: `${String(cells.length)} colonnes trouvées, ${String(REQUIRED_COLUMNS)} ou ${String(LEASE_IMPORT_HEADERS.length)} attendues.` });
      continue;
    }
    const [unitText = '', tenantText = '', start = '', end = '', rent = '', charges = '', deposit = '', kind = ''] = cells;
    const unitKey = fold(unitText);
    const unit = units.find((entry) => fold(entry.label) === unitKey || entry.id === unitKey || fold(`${entry.label} ${entry.building}`) === unitKey);
    if (!unit) {
      report.rejected.push({ line, reason: `Bien inconnu : « ${unitText} ».` });
      continue;
    }
    const tenantKey = fold(tenantText);
    const tenant = tenants.find((entry) => fold(entry.name) === tenantKey || entry.id === tenantKey);
    if (!tenant) {
      report.rejected.push({ line, reason: `Locataire inconnu : « ${tenantText} ».` });
      continue;
    }
    const furnished = furnishedOf(kind);
    if (furnished === undefined) {
      report.rejected.push({ line, reason: `Type inconnu : « ${kind} », attendu vide ou meublé.` });
      continue;
    }
    const parsed = leaseImportRowSchema.safeParse({ unitId: unit.id, tenantId: tenant.id, start: isoOf(start), end: isoOf(end), rent, charges, deposit, furnished });
    if (!parsed.success) {
      report.rejected.push({ line, reason: parsed.error.issues[0]?.message ?? 'Ligne invalide.' });
      continue;
    }
    const fields = importedLeaseFields(parsed.data, today);
    const clash = findImportClash(existing, staged, fields);
    if (clash) {
      const owner = clash.reference ? `le bail ${clash.reference}` : 'une ligne précédente du fichier';
      report.rejected.push({ line, reason: `${unit.label} est déjà loué du ${formatDateFr(clash.start)} au ${formatDateFr(clash.end)} (${owner}).` });
      continue;
    }
    staged.push({ unitId: fields.unitId, start: fields.start, end: fields.end });
    report.accepted.push({ line, input: parsed.data });
  }
  return report;
}
