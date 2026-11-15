import { z } from "zod";

export const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const isoDaySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const minorSchema = z.number().int().nonnegative();

export const mandantTypeSchema = z.enum(["particulier", "societe", "indivision"]);
export type MandantType = z.infer<typeof mandantTypeSchema>;

export const mandantSchema = z.object({
  id: slugSchema,
  name: z.string().min(1),
  legal: z.string().min(1),
  type: mandantTypeSchema,
  sinceIso: isoDaySchema,
  email: z.email(),
  phoneMasked: z.string(),
  address: z.string().min(1),
  ibanLast4: z.string().regex(/^\d{3,4}$/),
  ownerSpaceActive: z.boolean(),
  reportsByEmail: z.boolean(),
});
export type Mandant = z.infer<typeof mandantSchema>;

export const mandatStatusSchema = z.enum(["actif", "a_renouveler", "termine", "brouillon"]);
export type MandatStatus = z.infer<typeof mandatStatusSchema>;

export const terminationSchema = z.object({
  reason: z.string().min(1),
  effectIso: isoDaySchema,
  noticeIso: isoDaySchema,
  note: z.string(),
});
export type Termination = z.infer<typeof terminationSchema>;

export const mandatSchema = z.object({
  id: slugSchema,
  number: z.string().regex(/^M-\d{4}-\d{4}$/),
  mandantId: slugSchema,
  status: mandatStatusSchema,
  startIso: isoDaySchema,
  endIso: isoDaySchema,
  feeBasisPoints: z.number().int().min(0).max(2_000),
  payoutDay: z.number().int().min(1).max(28),
  worksLimitMinor: minorSchema,
  renewal: z.enum(["aucune", "tacite"]),
  guaranteeUntilIso: isoDaySchema,
  signed: z.boolean(),
  termination: terminationSchema.optional(),
});
export type Mandat = z.infer<typeof mandatSchema>;

export const bienSchema = z.object({
  id: slugSchema,
  name: z.string().min(1),
  kind: z.string().min(1),
  surfaceM2: z.number().positive(),
  street: z.string().min(1),
  postalCode: z.string().regex(/^\d{5}$/),
  city: z.string().min(1),
  mandatId: slugSchema,
  floor: z.string(),
  dpe: z.string(),
  heating: z.string(),
  syndic: z.string(),
  pnoUntilIso: isoDaySchema,
  propertyTax: z.string(),
  targetRentMinor: minorSchema.optional(),
  targetChargesMinor: minorSchema.optional(),
});
export type Bien = z.infer<typeof bienSchema>;

export const bailStatusSchema = z.enum(["en_cours", "a_venir", "termine", "brouillon"]);
export type BailStatus = z.infer<typeof bailStatusSchema>;

export const paymentModeSchema = z.enum(["virement", "prelevement", "cheque"]);
export type PaymentMode = z.infer<typeof paymentModeSchema>;

const yearMonthSchema = z.string().regex(/^\d{4}-\d{2}$/);

export const bailSchema = z.object({
  id: slugSchema,
  number: z.string().min(1),
  bienId: slugSchema,
  locataireId: slugSchema,
  status: bailStatusSchema,
  furnished: z.boolean(),
  startIso: isoDaySchema,
  endIso: isoDaySchema,
  rentMinor: minorSchema,
  chargesMinor: minorSchema,
  depositMinor: minorSchema,
  dueDay: z.number().int().min(1).max(28),
  paymentMode: paymentModeSchema,
  overdueSinceIso: isoDaySchema.optional(),
  noticeGiven: z.boolean(),
  guarantor: z.string().optional(),
  note: z.string().optional(),
  paymentOverrides: z.record(yearMonthSchema, z.object({ day: z.number().int().min(1).max(28), mode: paymentModeSchema.optional() })).optional(),
});
export type Bail = z.infer<typeof bailSchema>;

export const locataireSchema = z.object({
  id: slugSchema,
  name: z.string().min(1),
  email: z.email(),
  phoneMasked: z.string(),
  bankLast4: z.string().regex(/^\d{3,4}$/),
  spaceActive: z.boolean(),
  archived: z.boolean(),
});
export type Locataire = z.infer<typeof locataireSchema>;

export const eventKindSchema = z.enum(["mandant", "mandat", "bien", "locataire", "bail"]);
export type EventKind = z.infer<typeof eventKindSchema>;

export const activityEventSchema = z.object({
  id: z.string().min(1),
  kind: eventKindSchema,
  subjectId: slugSchema,
  dateIso: isoDaySchema,
  title: z.string().min(1),
  detail: z.string(),
  tone: z.enum(["neutral", "danger", "warning", "success", "info"]),
  badge: z.string().optional(),
});
export type ActivityEvent = z.infer<typeof activityEventSchema>;

export const interventionSummarySchema = z.object({
  id: z.string().min(1),
  bienId: slugSchema,
  title: z.string().min(1),
  dateIso: isoDaySchema,
  amountMinor: minorSchema,
  note: z.string(),
  done: z.boolean(),
});
export type InterventionSummary = z.infer<typeof interventionSummarySchema>;

export const messageSummarySchema = z.object({
  id: z.string().min(1),
  locataireId: slugSchema,
  title: z.string().min(1),
  dateIso: isoDaySchema,
  from: z.string().min(1),
  state: z.enum(["a_repondre", "envoye", "lu"]),
});
export type MessageSummary = z.infer<typeof messageSummarySchema>;

export const complianceItemSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  detail: z.string().min(1),
  state: z.enum(["valide", "a_renouveler", "conforme"]),
});
export type ComplianceItem = z.infer<typeof complianceItemSchema>;

export const avenantKindSchema = z.enum(["honoraires", "duree", "reversement", "travaux"]);
export type AvenantKind = z.infer<typeof avenantKindSchema>;

export const avenantSchema = z.object({
  id: slugSchema,
  number: z.string().regex(/^AV-\d{4}-\d{4}$/),
  mandatId: slugSchema,
  kind: avenantKindSchema,
  effectIso: isoDaySchema,
  createdIso: isoDaySchema,
  applied: z.boolean(),
  feeBasisPoints: z.number().int().min(0).max(2_000).optional(),
  endIso: isoDaySchema.optional(),
  payoutDay: z.number().int().min(1).max(28).optional(),
  worksLimitMinor: minorSchema.optional(),
  previous: z.string(),
  next: z.string(),
  note: z.string(),
});
export type Avenant = z.infer<typeof avenantSchema>;

export const invitationStatusSchema = z.enum(["envoyee", "acceptee", "expiree", "annulee"]);
export type InvitationStatus = z.infer<typeof invitationStatusSchema>;

export const invitationSchema = z.object({
  id: slugSchema,
  email: z.email(),
  name: z.string().min(1),
  bailId: slugSchema,
  message: z.string(),
  link: z.url({ protocol: /^https$/ }),
  sentIso: isoDaySchema,
  expiresIso: isoDaySchema,
  status: invitationStatusSchema,
  reminders: z.number().int().nonnegative(),
});
export type Invitation = z.infer<typeof invitationSchema>;

export const avisSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+@\d{4}-\d{2}$/),
  bailId: slugSchema,
  month: yearMonthSchema,
  sentIso: isoDaySchema,
});
export type Avis = z.infer<typeof avisSchema>;

export const portefeuilleSchema = z.object({
  agencyName: z.string().min(1),
  managerFirstName: z.string().min(1),
  todayIso: isoDaySchema,
  mandants: z.array(mandantSchema),
  mandats: z.array(mandatSchema),
  biens: z.array(bienSchema),
  locataires: z.array(locataireSchema),
  baux: z.array(bailSchema),
  events: z.array(activityEventSchema),
  interventions: z.array(interventionSummarySchema),
  messages: z.array(messageSummarySchema),
  compliance: z.array(complianceItemSchema),
  avenants: z.array(avenantSchema),
  invitations: z.array(invitationSchema),
  avis: z.array(avisSchema),
});
export type PortefeuilleData = z.infer<typeof portefeuilleSchema>;
