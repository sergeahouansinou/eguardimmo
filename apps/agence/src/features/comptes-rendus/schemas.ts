import { z } from "zod";
import { isIsoDate } from "@/features/shared/dates";
import { mandantStatementSchema } from "@/features/shared/statement";

export const REPORT_STATES = ["a_generer", "brouillon", "genere", "publie"] as const;
export const PERIOD_KINDS = ["mensuel", "trimestriel", "personnalise"] as const;
export const CONTENT_KEYS = ["loyers", "honoraires", "reversement", "impayes", "travaux", "quittances"] as const;

export const reportStateSchema = z.enum(REPORT_STATES);
export const periodKindSchema = z.enum(PERIOD_KINDS);
export const contentKeySchema = z.enum(CONTENT_KEYS);

export const pdfOptionsSchema = z.object({
  receiptsAttached: z.boolean(),
  letterhead: z.boolean(),
  reminderDetail: z.boolean(),
});

export const reportRowSchema = z.object({
  id: z.string(),
  mandantId: z.string(),
  mandantName: z.string(),
  mandantKind: z.string(),
  periodKey: z.string(),
  periodLabel: z.string(),
  periodShort: z.string(),
  state: reportStateSchema,
  collectedMinor: z.number().int(),
  feeMinor: z.number().int(),
  netMinor: z.number().int(),
  lots: z.number().int(),
  lastSentOn: z.string().nullable(),
  lastSentShort: z.string().nullable(),
});

export const overviewSchema = z.object({
  currentPeriod: z.string(),
  currentPeriodLabel: z.string(),
  nextSendOn: z.string(),
  lastSend: z
    .object({ on: z.string(), periodShort: z.string(), count: z.number().int(), read: z.number().int(), unknownReads: z.boolean() })
    .nullable(),
  rows: z.array(reportRowSchema),
});

export const mandantPreviewSchema = z.object({
  mandantId: z.string(),
  mandantName: z.string(),
  mandantKind: z.string(),
  lots: z.number().int(),
  collectedMinor: z.number().int(),
  feeMinor: z.number().int(),
  netMinor: z.number().int(),
  receipts: z.number().int(),
});

export const receiptSchema = z.object({
  reference: z.string(),
  lotLabel: z.string(),
  tenantName: z.string(),
  paidOn: z.string(),
  amountMinor: z.number().int(),
});

export const reminderSchema = z.object({
  lotLabel: z.string(),
  tenantName: z.string(),
  rank: z.number().int(),
  sentOn: z.string(),
});

export const reportDetailSchema = z.object({
  id: z.string(),
  state: reportStateSchema,
  kind: periodKindSchema,
  from: z.string(),
  to: z.string(),
  periodLabel: z.string(),
  content: z.array(contentKeySchema),
  options: pdfOptionsSchema,
  publication: z.enum(["planifiee", "maintenant"]),
  notify: z.boolean(),
  generatedOn: z.string().nullable(),
  publishedOn: z.string().nullable(),
  statement: mandantStatementSchema,
  receipts: z.array(receiptSchema),
  reminders: z.array(reminderSchema),
});

export type ReportState = z.output<typeof reportStateSchema>;
export type PeriodKind = z.output<typeof periodKindSchema>;
export type ContentKey = z.output<typeof contentKeySchema>;
export type PdfOptions = z.output<typeof pdfOptionsSchema>;
export type ReportRow = z.output<typeof reportRowSchema>;
export type Overview = z.output<typeof overviewSchema>;
export type MandantPreview = z.output<typeof mandantPreviewSchema>;
export type ReportDetail = z.output<typeof reportDetailSchema>;

const generationFields = z.object({
  kind: periodKindSchema,
  from: z.string().refine(isIsoDate, "Date de début invalide."),
  to: z.string().refine(isIsoDate, "Date de fin invalide."),
  mandantIds: z.array(z.string()).min(1, "Sélectionnez au moins un mandant."),
  content: z.array(contentKeySchema),
  publication: z.enum(["planifiee", "maintenant"]),
  notify: z.boolean(),
});

function endFollowsStart(value: { from: string; to: string }): boolean {
  return !isIsoDate(value.from) || !isIsoDate(value.to) || value.from <= value.to;
}

const END_AFTER_START = { path: ["to"], message: "La date de fin doit suivre la date de début." };

export const generationSchema = generationFields.refine(endFollowsStart, END_AFTER_START);

export const generateRequestSchema = generationFields.extend({ draft: z.boolean() }).refine(endFollowsStart, END_AFTER_START);

export type GenerationInput = z.input<typeof generationSchema>;
export type GenerateRequest = z.input<typeof generateRequestSchema>;

export const rangeSchema = z
  .object({ from: z.string().refine(isIsoDate, "Date de début invalide."), to: z.string().refine(isIsoDate, "Date de fin invalide.") })
  .refine((value) => value.from <= value.to, { path: ["to"], message: "La date de fin doit suivre la date de début." });

export type RangeInput = z.input<typeof rangeSchema>;

export const pdfOptionsInputSchema = pdfOptionsSchema.extend({ id: z.string().min(1) });

export type PdfOptionsInput = z.input<typeof pdfOptionsInputSchema>;

export const CONTENT_LABELS: Record<ContentKey, string> = {
  loyers: "Loyers encaissés par lot",
  honoraires: "Honoraires et TVA",
  reversement: "Reversement et compte",
  impayes: "Impayés en cours",
  travaux: "Travaux et interventions",
  quittances: "Quittances jointes",
};

export const DEFAULT_CONTENT: readonly ContentKey[] = ["loyers", "honoraires", "reversement", "impayes", "quittances"];
