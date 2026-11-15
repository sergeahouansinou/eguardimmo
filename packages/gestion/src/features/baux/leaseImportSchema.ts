import { z } from 'zod';
import { addMonths, daysBetween, addDays } from '../locataires/kit/dates';
import { parseEuros } from '../locataires/kit/money';
import { EURO_INPUT } from './schemas';
import type { Lease, LeaseStatus } from './schemas';

export const MAX_LEASE_IMPORT_ROWS = 200;

const isoDate = z.iso.date();

export const leaseImportRowSchema = z
  .object({
    unitId: z.string().min(1, 'Choisissez le bien'),
    tenantId: z.string().min(1, 'Choisissez le locataire'),
    start: z.string().trim().min(1, 'Renseignez la date de début').pipe(isoDate),
    end: z.string().trim().min(1, 'Renseignez la date de fin').pipe(isoDate),
    rent: z.string(),
    charges: z.string(),
    deposit: z.string(),
    furnished: z.boolean(),
  })
  .superRefine((value, context) => {
    const fail = (path: string, message: string) => { context.addIssue({ code: 'custom', path: [path], message }); };
    if (isoDate.safeParse(value.start).success && isoDate.safeParse(value.end).success && value.end <= value.start) {
      fail('end', 'La fin doit suivre le début du bail');
    }
    const rentOk = EURO_INPUT.test(value.rent.trim()) && parseEuros(value.rent) > 0;
    if (!rentOk) fail('rent', 'Indiquez le loyer, ex. 850 ou 850,50');
    if (!EURO_INPUT.test(value.charges.trim())) fail('charges', 'Indiquez les charges, 0 s’il n’y en a pas');
    if (!EURO_INPUT.test(value.deposit.trim())) fail('deposit', 'Indiquez le dépôt de garantie, 0 s’il n’y en a pas');
    else if (rentOk) {
      const maxMonths = value.furnished ? 2 : 1;
      if (parseEuros(value.deposit) > parseEuros(value.rent) * maxMonths) {
        fail('deposit', `Le dépôt ne peut pas dépasser ${String(maxMonths)} mois de loyer hors charges`);
      }
    }
  });
export type LeaseImportRow = z.infer<typeof leaseImportRowSchema>;

export type ImportedLeaseFields = Pick<
  Lease,
  'unitId' | 'tenantIds' | 'furnished' | 'durationMonths' | 'legalNote' | 'start' | 'end' | 'rent' | 'charges' | 'deposit' | 'dueDay' | 'paymentMethod' | 'nextRevision' | 'tacitNote' | 'note' | 'status'
>;

function nextAnniversary(start: string, today: string): string {
  let next = addMonths(start, 12);
  while (next <= today) next = addMonths(next, 12);
  return next;
}

export function importedLeaseFields(row: LeaseImportRow, today: string): ImportedLeaseFields {
  const status: LeaseStatus = row.end < today ? 'termine' : row.start > today ? 'a_venir' : 'en_cours';
  return {
    unitId: row.unitId,
    tenantIds: [row.tenantId],
    furnished: row.furnished,
    durationMonths: Math.max(1, Math.round(daysBetween(row.start, addDays(row.end, 1)) / 30.4375)),
    legalNote: row.furnished ? 'Location meublée, loi de 1989' : 'Location vide, loi de 1989',
    start: row.start,
    end: row.end,
    rent: parseEuros(row.rent),
    charges: parseEuros(row.charges),
    deposit: parseEuros(row.deposit),
    dueDay: 1,
    paymentMethod: 'virement',
    nextRevision: status === 'termine' ? null : nextAnniversary(row.start, today),
    tacitNote: row.furnished ? 'Reconduction tacite, 1 an' : 'Reconduction tacite, 3 ans',
    note: 'Importé depuis un fichier CSV.',
    status,
  };
}
