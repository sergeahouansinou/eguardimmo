import { z } from "zod";
import { isIsoDate } from "@/features/shared/dates";

const isoDate = z.string().refine(isIsoDate, "Date invalide.");
const key = z.string().min(8, "Clé d'idempotence manquante.");
const minor = z.number().int();

export const paymentModeSchema = z.enum(["virement", "cheque", "prelevement", "especes"]);
export const channelSchema = z.enum(["email", "sms", "courrier"]);
export const feeBaseSchema = z.enum(["rent", "rent_and_charges"]);

export const recordPaymentSchema = z.object({
  idempotencyKey: key,
  installmentId: z.string().min(1, "Choisissez une échéance."),
  amountMinor: minor.positive("Saisissez un montant supérieur à 0."),
  receivedOn: isoDate,
  mode: paymentModeSchema,
  reference: z.string().trim().max(80, "80 caractères au maximum."),
  note: z.string().trim().max(500, "500 caractères au maximum."),
  receipt: z.boolean(),
  notifyTenant: z.boolean(),
  notifyMandant: z.boolean(),
});

export const previewPaymentSchema = z.object({
  installmentId: z.string(),
  amountMinor: minor,
  receivedOn: z.string(),
});

export const paymentIdSchema = z.object({ paymentId: z.string().min(1) });

export const rejectPaymentSchema = z.object({
  paymentId: z.string().min(1),
  reason: z.string().trim().min(3, "Indiquez le motif du rejet.").max(200, "200 caractères au maximum."),
});

export const reminderSchema = z.object({
  lotIds: z.array(z.string()).min(1, "Sélectionnez au moins un dossier."),
  channel: channelSchema,
  message: z.string().trim().min(10, "Rédigez un message d'au moins 10 caractères.").max(1000, "1 000 caractères au maximum."),
});

export const planSchema = z.object({
  lotId: z.string().min(1),
  installments: minor.min(2, "Entre 2 et 6 mensualités.").max(6, "Entre 2 et 6 mensualités."),
  firstDueOn: isoDate,
});

export const lotIdSchema = z.object({ lotId: z.string().min(1) });
export const mandantIdSchema = z.object({ mandantId: z.string().min(1) });

export const validateLotSchema = z.object({ batchId: z.string().min(1), idempotencyKey: key });
export const batchMemberSchema = z.object({ batchId: z.string().min(1), mandantId: z.string().min(1) });

export const blockSchema = z.object({
  mandantId: z.string().min(1),
  reason: z.string().trim().min(5, "Indiquez le motif du blocage (5 caractères minimum).").max(200, "200 caractères au maximum."),
});

export const baremeInputSchema = z.object({
  mandateId: z.string().min(1, "Choisissez un mandat."),
  rateBp: minor.min(1, "Le taux doit être supérieur à 0 %.").max(2500, "Le taux ne peut pas dépasser 25 %."),
  base: feeBaseSchema,
  minFeeMinor: minor.min(0, "Le minimum ne peut pas être négatif.").max(50_000, "Minimum trop élevé."),
  lettingBp: minor.min(0, "Entre 0 et 100 %.").max(10_000, "Entre 0 et 100 %."),
  worksBp: minor.min(0, "Entre 0 et 15 %.").max(1500, "Entre 0 et 15 %."),
  effectiveFrom: isoDate,
});

export type RecordPaymentInput = z.input<typeof recordPaymentSchema>;
export type PreviewPaymentInput = z.input<typeof previewPaymentSchema>;
export type RejectPaymentInput = z.input<typeof rejectPaymentSchema>;
export type ReminderInput = z.input<typeof reminderSchema>;
export type PlanInput = z.input<typeof planSchema>;
export type ValidateLotInput = z.input<typeof validateLotSchema>;
export type BatchMemberInput = z.input<typeof batchMemberSchema>;
export type BlockInput = z.input<typeof blockSchema>;
export type BaremeInput = z.input<typeof baremeInputSchema>;
export type PaymentMode = z.output<typeof paymentModeSchema>;
export type ReminderChannel = z.output<typeof channelSchema>;
export type FeeBase = z.output<typeof feeBaseSchema>;
