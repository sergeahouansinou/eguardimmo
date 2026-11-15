import { reservationInputSchema } from './schemas';
import type { Reservation, ReservationInput } from './schemas';
import { addDays, formatDateFr } from '../locataires/kit/dates';
import { slugify } from '../locataires/kit/ids';

export const IMPORT_HEADERS = ['Bien', 'Voyageur', 'Arrivée', 'Départ', 'Montant', 'Acompte', 'Dépôt'] as const;
const REQUIRED_COLUMNS = 6;
export const MAX_IMPORT_ROWS = 200;

export interface ImportUnit {
  id: string;
  label: string;
  building: string;
}

export interface RejectedLine {
  line: number;
  reason: string;
}

export interface ImportReport {
  accepted: { line: number; input: ReservationInput }[];
  rejected: RejectedLine[];
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
  if (french) return `${french[3] ?? ''}-${french[2] ?? ''}-${french[1] ?? ''}`;
  return text;
}

function findUnit(units: readonly ImportUnit[], text: string): ImportUnit | undefined {
  const key = fold(text);
  return units.find((unit) => fold(unit.label) === key || unit.id === key || fold(`${unit.label} ${unit.building}`) === key);
}

export function parseReservationsCsv(
  text: string,
  units: readonly ImportUnit[],
  existing: readonly Pick<Reservation, 'unitId' | 'arrival' | 'departure' | 'status'>[],
  today: string,
): ImportReport {
  const report: ImportReport = { accepted: [], rejected: [] };
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
  const expected = IMPORT_HEADERS.slice(0, REQUIRED_COLUMNS).map(fold);
  if (!expected.every((name, index) => columns[index] === name)) {
    report.rejected.push({ line: header.line, reason: `En-tête invalide : attendu ${IMPORT_HEADERS.slice(0, REQUIRED_COLUMNS).join(';')}.` });
    return report;
  }
  if (rows.length > MAX_IMPORT_ROWS) {
    report.rejected.push({ line: rows[MAX_IMPORT_ROWS]?.line ?? 0, reason: `Le fichier dépasse ${String(MAX_IMPORT_ROWS)} réservations.` });
    return report;
  }
  const taken: Pick<Reservation, 'unitId' | 'arrival' | 'departure' | 'status'>[] = [...existing];
  for (const { raw, line } of rows) {
    const cells = splitLine(raw);
    if (cells.length < REQUIRED_COLUMNS || cells.length > IMPORT_HEADERS.length) {
      report.rejected.push({ line, reason: `${String(cells.length)} colonnes trouvées, ${String(REQUIRED_COLUMNS)} ou ${String(IMPORT_HEADERS.length)} attendues.` });
      continue;
    }
    const [unitText = '', guest = '', arrival = '', departure = '', amount = '', paid = '', deposit = ''] = cells;
    const unit = findUnit(units, unitText);
    if (!unit) {
      report.rejected.push({ line, reason: `Bien inconnu : « ${unitText} ».` });
      continue;
    }
    const isPaid = paid.trim() !== '' && paid.trim() !== '0';
    const input = {
      unitId: unit.id,
      guest,
      arrival: isoOf(arrival),
      departure: isoOf(departure),
      amount,
      deposit: deposit === '' ? '0' : deposit,
      paid: paid === '' ? '0' : paid,
      mode: isPaid ? ('confirmee' as const) : ('option' as const),
      optionUntil: isPaid ? '' : addDays(today, 7),
    };
    const parsed = reservationInputSchema.safeParse(input);
    if (!parsed.success) {
      report.rejected.push({ line, reason: parsed.error.issues[0]?.message ?? 'Ligne invalide.' });
      continue;
    }
    if (input.mode === 'option' && input.optionUntil > input.arrival) input.optionUntil = addDays(input.arrival, -1);
    const clash = taken.find((other) => other.status !== 'annulee' && other.unitId === input.unitId && other.arrival < input.departure && other.departure > input.arrival);
    if (clash) {
      report.rejected.push({ line, reason: `${unit.label} est déjà réservé du ${formatDateFr(clash.arrival)} au ${formatDateFr(clash.departure)}.` });
      continue;
    }
    taken.push({ unitId: input.unitId, arrival: input.arrival, departure: input.departure, status: 'confirmee' });
    report.accepted.push({ line, input });
  }
  return report;
}
