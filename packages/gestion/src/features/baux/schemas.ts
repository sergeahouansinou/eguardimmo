import { toneSchema } from '@eguardimmo/shell';
import { z } from 'zod';
import { parseEuros } from '../locataires/kit/money';

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
const minor = z.number().int();
const isoDate = z.iso.date();
const text = z.string().trim();
const required = (message: string) => text.min(1, message);
const yearMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

export const LEASE_STATUSES = ['brouillon', 'a_venir', 'en_cours', 'preavis', 'termine'] as const;
export const leaseStatusSchema = z.enum(LEASE_STATUSES);
export type LeaseStatus = z.infer<typeof leaseStatusSchema>;
export const PAYMENT_METHODS = ['virement', 'prelevement', 'cheque'] as const;
export const paymentMethodSchema = z.enum(PAYMENT_METHODS);
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;
export const paymentMethodLabel: Record<PaymentMethod, string> = {
  virement: 'Virement',
  prelevement: 'Prélèvement',
  cheque: 'Chèque',
};

export const leaseSchema = z.object({
  id: slug,
  reference: z.string().min(1),
  unitId: slug,
  tenantIds: z.array(slug),
  furnished: z.boolean(),
  durationMonths: z.number().int().positive(),
  legalNote: z.string(),
  start: isoDate,
  end: isoDate,
  rent: minor,
  charges: minor,
  deposit: minor,
  depositReceivedOn: isoDate.nullable(),
  dueDay: z.number().int().min(1).max(28),
  paymentMethod: paymentMethodSchema,
  revisionIndex: z.string(),
  nextRevision: isoDate.nullable(),
  revisionNote: z.string(),
  rentControl: z.string(),
  guarantor: z.string().nullable(),
  tacitNote: z.string(),
  status: leaseStatusSchema,
  balance: minor,
  note: z.string(),
  archived: z.boolean(),
});
export type Lease = z.infer<typeof leaseSchema>;

const EURO_INPUT = /^\d+([.,]\d{1,2})?$/;

export const leaseInputSchema = z
  .object({
    unitId: z.string(),
    furnished: z.boolean(),
    start: z.string(),
    durationMonths: z.string(),
    tenantIds: z.array(z.string()),
    paymentMethod: paymentMethodSchema,
    note: z.string(),
    rent: z.string(),
    charges: z.string(),
    deposit: z.string(),
    dueDay: z.string(),
    asDraft: z.boolean(),
  })
  .superRefine((value, context) => {
    const fail = (path: string, message: string) => { context.addIssue({ code: 'custom', path: [path], message }); };
    if (value.unitId.trim() === '') fail('unitId', 'Choisissez le bien loué');
    if (value.asDraft) return;
    if (value.tenantIds.length === 0) fail('tenantIds', 'Ajoutez au moins un locataire');
    if (!isoDate.safeParse(value.start).success) fail('start', 'Renseignez la date de début');
    if (!/^\d+$/.test(value.durationMonths) || Number(value.durationMonths) < 1) fail('durationMonths', 'Choisissez une durée');
    if (!EURO_INPUT.test(value.rent.trim()) || parseEuros(value.rent) <= 0) fail('rent', 'Indiquez le loyer, ex. 850 ou 850,50');
    if (!EURO_INPUT.test(value.charges.trim())) fail('charges', 'Indiquez les charges, 0 s’il n’y en a pas');
    if (!EURO_INPUT.test(value.deposit.trim())) fail('deposit', 'Indiquez le dépôt de garantie, 0 s’il n’y en a pas');
    if (EURO_INPUT.test(value.rent.trim()) && EURO_INPUT.test(value.deposit.trim())) {
      const maxMonths = value.furnished ? 2 : 1;
      if (parseEuros(value.deposit) > parseEuros(value.rent) * maxMonths) {
        fail('deposit', `Le dépôt ne peut pas dépasser ${String(maxMonths)} mois de loyer hors charges`);
      }
    }
    const day = Number(value.dueDay);
    if (!Number.isInteger(day) || day < 1 || day > 28) fail('dueDay', 'Jour compris entre 1 et 28');
  });
export type LeaseInput = z.infer<typeof leaseInputSchema>;

export const installmentSchema = z.object({
  id: slug,
  leaseId: slug,
  month: yearMonth,
  due: isoDate,
  called: minor,
  received: minor,
  paidOn: isoDate.nullable(),
  state: z.enum(['a_emettre', 'impaye', 'partiel', 'paye']),
  lateSettled: z.boolean(),
  receiptNumber: z.string().nullable(),
});
export type Installment = z.infer<typeof installmentSchema>;

const entry = z.object({ id: slug, title: z.string().min(1), detail: z.string(), tone: toneSchema });
export const leaseExtrasSchema = z.object({
  leaseId: slug,
  documents: z.array(entry.extend({ badge: z.object({ label: z.string(), tone: toneSchema }) })),
  history: z.array(entry.extend({ date: isoDate })),
  actions: z.array(entry.extend({ badge: z.object({ label: z.string(), tone: toneSchema }) })),
});
export type LeaseExtras = z.infer<typeof leaseExtrasSchema>;

export const EXIT_STEP_STATUSES = ['fait', 'a_planifier', 'prevu', 'a_faire'] as const;
export const exitStepSchema = z.object({
  id: slug,
  title: z.string().min(1),
  detail: z.string(),
  status: z.enum(EXIT_STEP_STATUSES),
});
export type ExitStep = z.infer<typeof exitStepSchema>;

export const exitSchema = z.object({
  leaseId: slug,
  noticeReceivedOn: isoDate,
  noticeKind: z.string(),
  noticeDuration: z.string(),
  departure: isoDate,
  lastInstallment: yearMonth,
  reason: z.string(),
  steps: z.array(exitStepSchema),
  repairs: z.array(
    z.object({
      id: slug,
      element: z.string().min(1),
      entryState: z.string(),
      preVisit: z.string(),
      imputation: z.enum(['degradation', 'proprietaire']),
      estimate: minor,
    }),
  ),
  unpaid: minor,
  chargesRegularisation: minor,
  depositReturned: z.boolean(),
  attestationId: slug.nullable(),
});
export type LeaseExit = z.infer<typeof exitSchema>;

export const noticeInputSchema = z.object({
  noticeReceivedOn: required('Renseignez la date de réception').pipe(isoDate),
  departure: required('Renseignez la date de départ').pipe(isoDate),
  reason: z.string(),
});
export type NoticeInput = z.infer<typeof noticeInputSchema>;

export const EDL_TYPES = ['entree', 'intermediaire', 'sortie'] as const;
export const edlTypeSchema = z.enum(EDL_TYPES);
export type EdlType = z.infer<typeof edlTypeSchema>;
export const edlTypeLabel: Record<EdlType, string> = { entree: 'Entrée', intermediaire: 'Intermédiaire', sortie: 'Sortie' };
export const EDL_STATUSES = ['brouillon', 'a_planifier', 'prevu', 'signe'] as const;
export const edlStatusSchema = z.enum(EDL_STATUSES);
export type EdlStatus = z.infer<typeof edlStatusSchema>;

export const edlTemplateSchema = z.object({ id: slug, label: z.string().min(1) });
export type EdlTemplate = z.infer<typeof edlTemplateSchema>;

export const ROOMS = ['Entrée', 'Séjour', 'Cuisine', 'Chambre 1', 'Chambre 2', 'Salle de bains'] as const;

export const edlSchema = z.object({
  id: slug,
  reference: z.string().min(1),
  type: edlTypeSchema,
  unitId: slug,
  tenantId: slug.nullable(),
  date: isoDate.nullable(),
  createdOn: isoDate.nullable(),
  templateId: slug,
  status: edlStatusSchema,
  rooms: z.array(z.string()),
  archived: z.boolean(),
});
export type Edl = z.infer<typeof edlSchema>;

export const edlInputSchema = z.object({
  type: edlTypeSchema,
  unitId: z.string().min(1, 'Choisissez le bien'),
  date: required('Renseignez la date').pipe(isoDate),
  tenantId: z.string(),
  templateId: z.string().min(1, 'Choisissez une grille'),
  rooms: z.array(z.string()).min(1, 'Contrôlez au moins une pièce'),
});
export type EdlInput = z.infer<typeof edlInputSchema>;

export const RESERVATION_STATUSES = ['option', 'confirmee', 'acompte_recu', 'solde_a_percevoir', 'annulee'] as const;
export const reservationStatusSchema = z.enum(RESERVATION_STATUSES);
export type ReservationStatus = z.infer<typeof reservationStatusSchema>;

export const reservationSchema = z.object({
  id: slug,
  reference: z.string().min(1),
  unitId: slug,
  guest: z.string().min(1),
  arrival: isoDate,
  departure: isoDate,
  amount: minor,
  deposit: minor,
  paid: minor,
  status: reservationStatusSchema,
  optionUntil: isoDate.nullable(),
});
export type Reservation = z.infer<typeof reservationSchema>;

export const attestationSchema = z.object({
  id: slug,
  number: z.string().min(1),
  leaseId: slug,
  leaseReference: z.string(),
  tenantName: z.string().min(1),
  tenantCivility: z.string(),
  unitId: slug,
  leaseStart: isoDate,
  leaseEnd: isoDate,
  exitDate: isoDate,
  issuedOn: isoDate,
  issuedAt: z.iso.datetime({ offset: true }),
  deposit: minor,
  depositReceivedOn: isoDate,
  deductions: z.array(z.object({ id: slug, label: z.string().min(1), reference: z.string(), amount: minor })),
  unpaid: minor,
  returned: minor,
  fingerprint: z.string().min(1),
  paymentMethod: paymentMethodSchema,
});
export type Attestation = z.infer<typeof attestationSchema>;

