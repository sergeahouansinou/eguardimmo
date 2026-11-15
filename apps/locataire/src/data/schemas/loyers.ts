import { z } from 'zod';
import { isValidIban } from '@/lib/iban';
import { cents, isoDate, isoDateTime, requiredText } from './common';

export const installmentSchema = z.object({
  id: z.string().regex(/^\d{4}-\d{2}$/),
  dueOn: isoDate,
  rentCents: cents.nonnegative(),
  provisionsCents: cents.nonnegative(),
  status: z.enum(['a_venir', 'impaye', 'en_attente', 'paye']),
  paidOn: isoDate.nullable(),
  paymentId: z.string().nullable(),
  receiptId: z.string().nullable(),
});
export type Installment = z.infer<typeof installmentSchema>;

export const paymentMethodSchema = z.enum(['carte', 'virement', 'prelevement']);
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

export const paymentSchema = z.object({
  id: z.string().regex(/^PAY-\d{4}-\d{4}$/),
  installmentId: z.string(),
  amountCents: cents.positive(),
  method: paymentMethodSchema,
  status: z.enum(['en_cours', 'en_attente', 'reussi', 'echoue', 'annule']),
  createdAt: isoDateTime,
  completedAt: isoDateTime.nullable(),
  receiptId: z.string().nullable(),
  failureReason: z.string().nullable(),
});
export type Payment = z.infer<typeof paymentSchema>;

export const startPaymentInputSchema = z.object({
  installmentId: z.string().regex(/^\d{4}-\d{2}$/),
  method: paymentMethodSchema,
});
export type StartPaymentInput = z.infer<typeof startPaymentInputSchema>;

export const paymentOutcomeSchema = z.enum(['reussi', 'echoue', 'annule']);
export type PaymentOutcome = z.infer<typeof paymentOutcomeSchema>;

export const receiptSchema = z.object({
  id: z.string(),
  number: z.string(),
  issuedOn: isoDate,
  installmentId: z.string(),
  periodStart: isoDate,
  periodEnd: isoDate,
  paidOn: isoDate,
  landlord: z.object({ name: z.string(), address: z.string() }),
  tenantName: z.string(),
  propertyLabel: z.string(),
  address: z.string(),
  leaseNumber: z.string(),
  leaseStart: isoDate,
  leaseEnd: isoDate,
  paymentLabel: z.string(),
  noticeNumber: z.string(),
  rentCents: cents,
  provisionsCents: cents,
  previousDebtCents: cents,
  totalReceivedCents: cents,
  cumul: z.object({ calledCents: cents, receivedCents: cents, balanceCents: cents, depositCents: cents }),
  seal: z.object({ fingerprint: z.string(), sealedAt: isoDateTime }),
});
export type Receipt = z.infer<typeof receiptSchema>;

export const chargesSchema = z.object({
  year: z.number().int(),
  provisionsPaidCents: cents,
  actualCents: cents,
  balanceCents: cents,
  status: z.enum(['remboursee', 'a_regler', 'compensee']),
  settledOn: isoDate.nullable(),
  settlementLabel: z.string().nullable(),
  currentProvisionCents: cents,
  provisionNote: z.string(),
  monthlyProvisionCents: cents,
  lines: z.array(z.object({ label: z.string(), split: z.string(), amountCents: cents })),
});
export type ChargesStatement = z.infer<typeof chargesSchema>;

export const mandateSchema = z.object({
  reference: z.string(),
  creditor: z.string(),
  status: z.enum(['a_signer', 'actif', 'revoque']),
  holder: z.string().nullable(),
  ibanLast4: z.string().regex(/^\w{4}$/).nullable(),
  signedOn: isoDate.nullable(),
  amountCents: cents,
  dayOfMonth: z.number().int(),
  noticeDays: z.number().int(),
});
export type Mandate = z.infer<typeof mandateSchema>;

export const mandateInputSchema = z.object({
  holder: requiredText('Le titulaire'),
  iban: z
    .string()
    .trim()
    .min(1, "L'IBAN est obligatoire.")
    .refine(isValidIban, "L'IBAN n'est pas valide : vérifiez les caractères et la clé de contrôle."),
  authorize: z.literal(true, { error: 'Vous devez autoriser le prélèvement.' }),
  confirmHolder: z.literal(true, { error: 'Vous devez confirmer être titulaire du compte.' }),
});
export type MandateInput = z.infer<typeof mandateInputSchema>;
