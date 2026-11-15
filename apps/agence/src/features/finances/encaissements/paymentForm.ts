import { z } from "zod";
import { DEMO_TODAY, isIsoDate } from "@/features/shared/dates";
import { parseMoney } from "@/features/shared/money";
import { paymentModeSchema } from "../inputs";

export const paymentFormSchema = z.object({
  lotId: z.string().min(1, "Choisissez un locataire."),
  installmentId: z.string().min(1, "Choisissez l'échéance concernée."),
  amount: z
    .string()
    .trim()
    .min(1, "Saisissez le montant reçu.")
    .refine((value) => (parseMoney(value) ?? 0) > 0, "Montant invalide. Exemple : 450,00."),
  receivedOn: z
    .string()
    .refine(isIsoDate, "Saisissez une date valide.")
    .refine((value) => value <= DEMO_TODAY, "La date de réception ne peut pas être dans le futur."),
  mode: paymentModeSchema,
  reference: z.string().trim().max(80, "80 caractères au maximum."),
  note: z.string().trim().max(500, "500 caractères au maximum."),
  receipt: z.boolean(),
  notifyTenant: z.boolean(),
  notifyMandant: z.boolean(),
});

export type PaymentFormInput = z.input<typeof paymentFormSchema>;
export type PaymentFormValues = z.output<typeof paymentFormSchema>;
