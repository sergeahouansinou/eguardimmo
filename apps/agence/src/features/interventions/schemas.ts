import { z } from "zod";
import { isIsoDate } from "@/features/shared/dates";
import { parseMoney } from "@/features/shared/money";

export const PRIORITIES = ["urgente", "normale", "basse"] as const;
export const STATUSES = ["ouverte", "en_cours", "devis_a_soumettre", "devis_soumis", "terminee", "archivee"] as const;
export const OPEN_STATUSES = ["ouverte", "en_cours", "devis_a_soumettre", "devis_soumis"] as const;

export const prioritySchema = z.enum(PRIORITIES);
export const statusSchema = z.enum(STATUSES);
export const eventToneSchema = z.enum(["default", "success", "warning", "danger", "neutral"]);

export const interventionEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  at: z.string(),
  detail: z.string().nullable(),
  tone: eventToneSchema,
});

export const interventionSchema = z.object({
  id: z.string(),
  subject: z.string(),
  propertyLabel: z.string(),
  commonParts: z.boolean(),
  lotId: z.string().nullable(),
  mandantId: z.string(),
  address: z.string(),
  tenantId: z.string().nullable(),
  contractor: z.string(),
  contractorContact: z.string(),
  contractorPhone: z.string(),
  passage: z.string().nullable(),
  dueOn: z.string().nullable(),
  priority: prioritySchema,
  priorityNote: z.string().nullable(),
  status: statusSchema,
  description: z.string(),
  reportedOn: z.string(),
  reportedBy: z.string(),
  completedOn: z.string().nullable(),
  estimatedMinor: z.number().int().nullable(),
  ceilingMinor: z.number().int(),
  approvalRequired: z.boolean(),
  notifyTenant: z.boolean(),
  notifyMandant: z.boolean(),
  photos: z.array(z.string()),
  devisId: z.string().nullable(),
  events: z.array(interventionEventSchema),
});

export const devisLineSchema = z.object({
  label: z.string(),
  quantity: z.number().int(),
  unit: z.string(),
  unitMinor: z.number().int(),
  totalMinor: z.number().int(),
});

export const DEVIS_MESSAGE_MAX_LENGTH = 500;

export const devisSchema = z.object({
  id: z.string(),
  interventionId: z.string(),
  title: z.string(),
  contractor: z.string(),
  issuedOn: z.string(),
  state: z.enum(["a_soumettre", "soumis"]),
  lines: z.array(devisLineSchema),
  vatBasisPoints: z.number().int(),
  htMinor: z.number().int(),
  vatMinor: z.number().int(),
  totalMinor: z.number().int(),
  ceilingMinor: z.number().int(),
  excessMinor: z.number().int(),
  mandantId: z.string(),
  mandateRef: z.string(),
  imputation: z.string(),
  deductedFrom: z.string(),
  responseWithinHours: z.number().int(),
  message: z.string().max(DEVIS_MESSAGE_MAX_LENGTH),
  submittedOn: z.string().nullable(),
});

export type Priority = z.output<typeof prioritySchema>;
export type Status = z.output<typeof statusSchema>;
export type InterventionEvent = z.output<typeof interventionEventSchema>;
export type Intervention = z.output<typeof interventionSchema>;
export type DevisLine = z.output<typeof devisLineSchema>;
export type Devis = z.output<typeof devisSchema>;

const baseFields = {
  subject: z.string().trim().min(3, "Indiquez le sujet (3 caractères au minimum).").max(120, "120 caractères au maximum."),
  lotId: z.string().min(1, "Choisissez le bien concerné."),
  priority: prioritySchema,
  dueOn: z.string().refine((value) => value === "" || isIsoDate(value), "Date d'échéance invalide."),
  contractor: z.string(),
  description: z.string().trim().max(1000, "1 000 caractères au maximum."),
  notifyTenant: z.boolean(),
  notifyMandant: z.boolean(),
};

export const interventionFormSchema = z.object({
  ...baseFields,
  estimated: z.string().refine((value) => value.trim() === "" || parseMoney(value) !== null, "Montant invalide, exemple : 380,00."),
});

export type InterventionFormInput = z.input<typeof interventionFormSchema>;
export type InterventionFormValues = z.output<typeof interventionFormSchema>;

export const createInterventionSchema = z.object({
  ...baseFields,
  estimatedMinor: z.number().int().min(0, "Montant négatif impossible.").max(100_000_000, "Montant trop élevé.").nullable(),
  photos: z.array(z.string().min(1)).max(5, "5 photos au maximum."),
});

export type CreateInterventionInput = z.input<typeof createInterventionSchema>;

export const statusChangeSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["en_cours", "terminee", "archivee", "ouverte"]),
});

export const priorityChangeSchema = z.object({ id: z.string().min(1), priority: prioritySchema });

export const submitDevisSchema = z.object({
  devisId: z.string().min(1),
});

export type StatusChangeInput = z.input<typeof statusChangeSchema>;
export type ChangeableStatus = StatusChangeInput["status"];
export type PriorityChangeInput = z.input<typeof priorityChangeSchema>;
export type SubmitDevisInput = z.input<typeof submitDevisSchema>;
