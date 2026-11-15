import { z } from "zod";
import { DEMO_TODAY, isIsoDate } from "@/features/shared/dates";
import { fileMetaSchema } from "@/features/kit/serverValidation";

export const isoDate = z.string().refine(isIsoDate, "Saisissez une date valide.");

const LAST_ALLOWED_DAY = "2100-12-31";

const futureBound = (value: string) => value <= LAST_ALLOWED_DAY;

export const CHANNELS = ["email", "app", "both"] as const;
export const channelSchema = z.enum(CHANNELS);
export type Channel = z.infer<typeof channelSchema>;

export const CHANNEL_LABELS: Record<Channel, string> = {
  email: "E-mail",
  app: "Notification dans l’application",
  both: "E-mail et notification dans l’application",
};

export const RECIPIENT_OPTIONS = [
  { value: "sophie-delmas", label: "Sophie Delmas" },
  { value: "camille-perrin", label: "Camille Perrin" },
  { value: "julien-mercier", label: "Julien Mercier" },
] as const;

const toneSchema = z.enum(["success", "warning", "danger", "neutral"]);
const timelineToneSchema = z.enum(["default", "success", "warning", "danger", "neutral"]);

export const detailSchema = z.object({
  label: z.string(),
  value: z.string(),
  field: z.enum(["reference", "expiresOn"]).optional(),
});

export const conditionSchema = z.object({
  id: z.string(),
  title: z.string(),
  detail: z.string().nullable(),
  pieceId: z.string().nullable(),
  manual: z.object({ label: z.string(), tone: toneSchema }).nullable(),
});

export const historyEntrySchema = z.object({
  id: z.string(),
  title: z.string(),
  detail: z.string(),
  date: isoDate,
  tone: timelineToneSchema,
});

export const pieceSchema = z.object({
  id: z.string(),
  title: z.string(),
  fullTitle: z.string(),
  subtitle: z.string(),
  reference: z.string(),
  expiresOn: isoDate,
  validLabel: z.string(),
  renewable: z.boolean(),
  renewalSubject: z.string(),
  renewalAction: z.string(),
  renewalImpact: z.string().nullable(),
  upkeepNote: z.string().nullable(),
  fileName: z.string().nullable(),
  details: z.array(detailSchema),
  conditions: z.array(conditionSchema),
  history: z.array(historyEntrySchema),
  reminder: z.object({ on: isoDate, channel: channelSchema }).nullable(),
});

export type Piece = z.infer<typeof pieceSchema>;
export type Condition = z.infer<typeof conditionSchema>;

export const remindersSchema = z.object({
  days: z.array(z.number().int().min(1).max(365)).min(1),
  recipients: z.array(z.string()).min(1),
  channels: z.array(z.enum(["email", "app"])).min(1),
});

export type Reminders = z.infer<typeof remindersSchema>;

export const conformiteSchema = z.object({
  pieces: z.array(pieceSchema),
  reminders: remindersSchema,
});

export type ConformiteData = z.infer<typeof conformiteSchema>;

export const PIECE_TYPES = [
  { value: "kbis", label: "Extrait Kbis" },
  { value: "vigilance", label: "Attestation de vigilance URSSAF" },
  { value: "mediateur", label: "Adhésion à un médiateur de la consommation" },
  { value: "autre", label: "Autre pièce" },
] as const;

const typeValues = ["kbis", "vigilance", "mediateur", "autre"] as const;

export const addPieceFormSchema = z
  .object({
    type: z.enum(typeValues, { error: "Choisissez le type de pièce." }),
    title: z.string().trim().max(80, "80 caractères au maximum."),
    reference: z.string().trim().min(3, "Saisissez la référence de la pièce.").max(60, "60 caractères au maximum."),
    expiresOn: isoDate.refine(futureBound, "Saisissez une échéance avant 2101."),
  })
  .superRefine((value, context) => {
    if (value.type === "autre" && value.title.length < 3) {
      context.addIssue({ code: "custom", path: ["title"], message: "Saisissez l’intitulé de la pièce." });
    }
  });

export type AddPieceForm = z.infer<typeof addPieceFormSchema>;

export const addPieceInputSchema = z.object({
  type: z.enum(typeValues),
  title: z.string().trim().max(80),
  reference: z.string().trim().min(3, "Saisissez la référence de la pièce.").max(60),
  expiresOn: isoDate.refine(futureBound, "Saisissez une échéance avant 2101."),
  file: fileMetaSchema,
});

export function renewFormSchema(currentExpiry: string) {
  return z.object({
    reference: z.string().trim().min(3, "Saisissez la nouvelle référence.").max(60, "60 caractères au maximum."),
    expiresOn: isoDate
      .refine((value) => value > currentExpiry, "La nouvelle échéance doit suivre l’échéance actuelle.")
      .refine((value) => value > DEMO_TODAY, "La nouvelle échéance doit être dans le futur.")
      .refine(futureBound, "Saisissez une échéance avant 2101."),
  });
}

export type RenewForm = z.infer<ReturnType<typeof renewFormSchema>>;

export function renewInputSchema(currentExpiry: string) {
  return renewFormSchema(currentExpiry).extend({ file: fileMetaSchema.nullable() });
}

export function reminderFormSchema(expiresOn: string) {
  return z.object({
    on: isoDate
      .refine((value) => value >= DEMO_TODAY, "Le rappel ne peut pas être dans le passé.")
      .refine((value) => value <= expiresOn, "Le rappel doit précéder l’échéance."),
    channel: channelSchema,
  });
}

export type ReminderForm = z.infer<ReturnType<typeof reminderFormSchema>>;

export const remindersFormSchema = z.object({
  days: z.array(z.string()).min(1, "Choisissez au moins une alerte."),
  recipients: z.array(z.string()).min(1, "Choisissez au moins un destinataire."),
  channels: z.array(z.enum(["email", "app"])).min(1, "Choisissez au moins un canal."),
});

export type RemindersForm = z.infer<typeof remindersFormSchema>;

export const remindersInputSchema = remindersSchema.extend({
  recipients: z.array(z.enum(["sophie-delmas", "camille-perrin", "julien-mercier"])).min(1),
});
