import { z } from "zod";

export const isoDate = z.iso.date();
export const cents = z.number().int();
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const yearMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

export const DOCUMENT_CATEGORIES = ["mandat", "compte_rendu", "quittance", "reversement", "fiscal", "assurance"] as const;
export const documentCategorySchema = z.enum(DOCUMENT_CATEGORIES);
export type DocumentCategory = z.infer<typeof documentCategorySchema>;

export const END_REASONS = ["gestion_directe", "vente", "changement_agence", "autre"] as const;
export const endReasonSchema = z.enum(END_REASONS);
export type EndReason = z.infer<typeof endReasonSchema>;

export const scheduleEntrySchema = z.object({
  month: yearMonth,
  dueOn: isoDate,
  called: cents,
  collected: cents,
  paidOn: isoDate.nullable(),
});

export const lotSchema = z.object({
  id: slug,
  label: z.string().min(1),
  kind: z.string().min(1),
  surface: z.number().int().positive(),
  address: z.string().min(1),
  floorRank: z.string().min(1),
  elevator: z.boolean(),
  heating: z.string().min(1),
  dpe: z.enum(["A", "B", "C", "D", "E", "F", "G"]),
  lotNumber: z.number().int().positive(),
  rent: z.object({ base: cents, provisions: cents }),
  tenant: z.object({ name: z.string().min(1), initials: z.string().min(1).max(2), leaseEndOn: isoDate }),
  lastPaymentOn: isoDate,
  schedule: z.array(scheduleEntrySchema).min(1),
  followUps: z.array(
    z.object({ id: slug, title: z.string(), on: isoDate, detail: z.string(), state: z.enum(["done", "planned"]) }),
  ),
});
export type Lot = z.infer<typeof lotSchema>;
export type ScheduleEntry = z.infer<typeof scheduleEntrySchema>;

const settlementLineSchema = z.object({ lotId: slug, called: cents, collected: cents, fees: cents });
export type SettlementLine = z.infer<typeof settlementLineSchema>;

export const settlementSchema = z.object({
  month: yearMonth,
  status: z.enum(["paid", "pending"]),
  reversedOn: isoDate,
  reference: z.string().min(1),
  works: cents,
  lines: z.array(settlementLineSchema).min(1),
});
export type Settlement = z.infer<typeof settlementSchema>;

const reportMonthSchema = z.object({
  month: yearMonth,
  called: cents,
  collected: cents,
  fees: cents,
  works: cents,
  reversedOn: isoDate,
  reference: z.string().min(1),
});

export const reportSchema = z.object({
  id: slug,
  label: z.string().min(1),
  longLabel: z.string().min(1),
  span: z.string().min(1),
  startOn: isoDate,
  endOn: isoDate,
  availableOn: isoDate,
  status: z.enum(["upcoming", "new", "viewed"]),
  months: z.array(reportMonthSchema),
  lots: z.array(z.object({ lotId: slug, collected: cents, fees: cents })),
  works: z.array(z.object({ title: z.string(), detail: z.string(), amount: cents })),
  arrears: z.array(
    z.object({ title: z.string(), detail: z.string(), tone: z.enum(["success", "danger"]), badge: z.string() }),
  ),
  observations: z.string(),
  pages: z.number().int().positive(),
  sizeKo: z.number().int().positive(),
});
export type Report = z.infer<typeof reportSchema>;

export const fiscalLineSchema = z.object({
  id: slug,
  group: z.enum(["recettes", "charges"]),
  label: z.string().min(1),
  amount: cents,
  origin: z.string().min(1),
});
export type FiscalLine = z.infer<typeof fiscalLineSchema>;

export const fiscalSchema = z.object({
  year: z.number().int(),
  asOf: isoDate,
  regime: z.enum(["reel", "micro"]),
  microAllowancePercent: z.number().int().min(0).max(100),
  lines: z.array(fiscalLineSchema).min(1),
  proofs: z.array(
    z.object({ id: slug, title: z.string(), detail: z.string(), tone: z.enum(["success", "warning"]), badge: z.string().optional() }),
  ),
});
export type Fiscal = z.infer<typeof fiscalSchema>;

export const documentSchema = z.object({
  id: slug,
  title: z.string().min(1),
  detail: z.string().min(1),
  category: documentCategorySchema,
  date: isoDate,
  sizeKo: z.number().int().positive(),
  lotIds: z.array(slug),
  validUntil: isoDate.optional(),
});
export type OwnerDocument = z.infer<typeof documentSchema>;

export const QUOTE_STATUSES = ["quote_pending", "quote_accepted", "quote_refused", "done"] as const;
export const interventionSchema = z.object({
  id: slug,
  ref: z.string().min(1),
  title: z.string().min(1),
  category: z.string().min(1),
  lotId: slug,
  artisan: z.string().min(1),
  status: z.enum(QUOTE_STATUSES),
  totalTtc: cents,
  vatRatePercent: z.number().int(),
  reportedOn: isoDate,
  doneOn: isoDate.nullable(),
  imputedOn: isoDate.nullable(),
  quote: z
    .object({
      ref: z.string().min(1),
      receivedOn: isoDate,
      validUntil: isoDate,
      decideBefore: isoDate,
      proposedOn: isoDate,
      reason: z.string(),
      lines: z.array(z.object({ label: z.string(), amount: cents })).min(1),
    })
    .nullable(),
  decision: z
    .object({ kind: z.enum(["accept", "refuse", "precision"]), comment: z.string(), decidedOn: isoDate })
    .nullable(),
  timeline: z.array(
    z.object({ id: z.string().min(1), title: z.string(), detail: z.string(), tone: z.enum(["default", "warning", "success", "danger"]) }),
  ),
  files: z.array(z.object({ id: slug, title: z.string(), detail: z.string() })),
});
export type Intervention = z.infer<typeof interventionSchema>;

export const agencySchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  phone: z.string().min(1),
  email: z.email(),
  hours: z.string().min(1),
  website: z.url({ protocol: /^https$/ }),
  manager: z.object({
    name: z.string().min(1),
    initials: z.string().min(1).max(2),
    role: z.string(),
    directPhone: z.string(),
    email: z.email(),
  }),
  guarantees: z.array(
    z.object({ id: slug, title: z.string(), detail: z.string(), tone: z.enum(["success", "warning"]), badge: z.string() }),
  ),
});

export const mandateSchema = z.object({
  reference: z.string().min(1),
  signedOn: isoDate,
  startOn: isoDate,
  endOn: isoDate,
  feeRatePercent: z.number().int().min(0).max(100),
  payoutDay: z.number().int().min(1).max(28),
  worksThreshold: cents,
  noticeMonths: z.number().int().positive(),
  lotIds: z.array(slug).min(1),
  files: z.array(z.object({ id: slug, title: z.string(), detail: z.string() })),
  endRequest: z
    .object({
      kind: z.enum(["at_term", "early"]),
      desiredOn: isoDate.nullable(),
      reason: endReasonSchema.nullable(),
      details: z.string(),
      requestedOn: isoDate,
    })
    .nullable(),
});
export type Mandate = z.infer<typeof mandateSchema>;

export const profileSchema = z.object({
  denomination: z.string().min(1),
  legalForm: z.string().min(1),
  siren: z.string().regex(/^\d{3} \d{3} \d{3}$/),
  representative: z.string().min(2),
  representativeRole: z.string().min(1),
  firstName: z.string().min(1),
  taxRegime: z.string().min(1),
  street: z.string().min(1),
  postalCode: z.string().regex(/^\d{5}$/),
  city: z.string().min(1),
  phone: z.string().min(1),
  email: z.email(),
  language: z.string().min(1),
  payout: z.object({ holder: z.string().min(1), ibanLast4: z.string().regex(/^[A-Z0-9]{4}$/), changedOn: isoDate }),
  pendingIbanChange: z.object({ ibanLast4: z.string().regex(/^[A-Z0-9]{4}$/), requestedOn: isoDate }).nullable(),
});
export type Profile = z.infer<typeof profileSchema>;

export const securitySchema = z.object({
  passwordChangedOn: isoDate,
  passwordStrength: z.string(),
  twoFactor: z.string(),
  backupCodes: z.number().int().nonnegative(),
  linkedAccounts: z.string(),
  linkedCount: z.number().int().nonnegative(),
  devices: z.number().int().nonnegative(),
});

export const preferenceSchema = z.object({
  id: slug,
  label: z.string().min(1),
  detail: z.string().min(1),
  email: z.boolean(),
  push: z.boolean(),
});
export type Preference = z.infer<typeof preferenceSchema>;

export const confieSchema = z.object({
  today: isoDate,
  profile: profileSchema,
  agency: agencySchema,
  mandate: mandateSchema,
  lots: z.array(lotSchema),
  settlements: z.array(settlementSchema),
  reports: z.array(reportSchema),
  fiscal: fiscalSchema,
  documents: z.array(documentSchema),
  interventions: z.array(interventionSchema),
  security: securitySchema,
  preferences: z.array(preferenceSchema),
  unreadMessages: z.number().int().nonnegative(),
  readNotificationIds: z.array(z.string()),
});
export type ConfieData = z.infer<typeof confieSchema>;
