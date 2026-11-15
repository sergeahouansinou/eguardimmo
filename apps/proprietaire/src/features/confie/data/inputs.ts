import { z } from "zod";
import { addMonths } from "./dates";
import { DOCUMENT_CATEGORIES, END_REASONS, isoDate } from "./schemas";

export const END_REASON_LABELS: Record<(typeof END_REASONS)[number], string> = {
  gestion_directe: "Reprise de la gestion en direct",
  vente: "Vente du bien",
  changement_agence: "Changement d'agence",
  autre: "Autre motif",
};

export const DOCUMENT_CATEGORY_LABELS: Record<(typeof DOCUMENT_CATEGORIES)[number], string> = {
  mandat: "Mandat",
  compte_rendu: "Compte rendu",
  quittance: "Quittance",
  reversement: "Reversement",
  fiscal: "Fiscal",
  assurance: "Assurance",
};

const comment = z.string().trim().max(500, "500 caractères au maximum.");

export const quoteDecisionSchema = z
  .object({
    interventionId: z.string().min(1),
    decision: z.enum(["accept", "refuse", "precision"]),
    comment,
  })
  .superRefine((value, ctx) => {
    if (value.decision === "refuse" && value.comment.length < 5) {
      ctx.addIssue({ code: "custom", path: ["comment"], message: "Indiquez le motif du refus, 5 caractères au minimum." });
    }
    if (value.decision === "precision" && value.comment.length < 5) {
      ctx.addIssue({ code: "custom", path: ["comment"], message: "Écrivez votre question à l'agence, 5 caractères au minimum." });
    }
  });
export type QuoteDecisionInput = z.infer<typeof quoteDecisionSchema>;

export function mandateEndSchema(minDate: string) {
  return z
    .object({
      kind: z.enum(["at_term", "early"]),
      desiredOn: z.union([isoDate, z.literal("")]),
      reason: z.union([z.enum(END_REASONS), z.literal("")]),
      details: comment,
    })
    .superRefine((value, ctx) => {
      if (value.kind !== "early") return;
      if (value.desiredOn === "") {
        ctx.addIssue({ code: "custom", path: ["desiredOn"], message: "Indiquez la date de fin souhaitée." });
      } else if (value.desiredOn < minDate) {
        ctx.addIssue({ code: "custom", path: ["desiredOn"], message: "La date doit respecter le préavis du mandat." });
      }
      if (value.reason === "") ctx.addIssue({ code: "custom", path: ["reason"], message: "Choisissez un motif." });
    });
}
export type MandateEndInput = z.infer<ReturnType<typeof mandateEndSchema>>;

export function earliestEndDate(today: string, noticeMonths: number): string {
  return addMonths(today, noticeMonths);
}

export const profileInputSchema = z.object({
  representative: z.string().trim().min(2, "Indiquez le nom du représentant."),
  street: z.string().trim().min(3, "Indiquez l'adresse."),
  postalCode: z.string().trim().regex(/^\d{5}$/, "Le code postal comporte 5 chiffres."),
  city: z.string().trim().min(2, "Indiquez la ville."),
  phone: z.string().trim().regex(/^\+?[\d ]{8,20}$/, "Numéro invalide, par exemple +33 6 00 00 00 02."),
  email: z.email("Adresse e-mail invalide."),
});
export type ProfileInput = z.infer<typeof profileInputSchema>;

export function isValidIban(raw: string): boolean {
  const iban = raw.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const char of rearranged) {
    const digits = /\d/.test(char) ? char : String(char.charCodeAt(0) - 55);
    for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

export const ibanInputSchema = z.object({
  iban: z
    .string()
    .trim()
    .refine(isValidIban, "IBAN invalide, vérifiez les chiffres, par exemple FR76 3000 6000 0112 3456 7890 189."),
});
export type IbanInput = z.infer<typeof ibanInputSchema>;

export const MAX_FILE_KO = 10_240;
export const ALLOWED_FILE_TYPES = ["application/pdf", "image/png", "image/jpeg"] as const;

export const documentInputSchema = z.object({
  title: z.string().trim().min(3, "Donnez un titre de 3 caractères au minimum.").max(120, "120 caractères au maximum."),
  category: z.enum(DOCUMENT_CATEGORIES),
  lotId: z.string(),
  fileType: z.string().refine((type) => ALLOWED_FILE_TYPES.some((allowed) => allowed === type), "Format accepté : PDF, PNG ou JPEG."),
  fileName: z.string().min(1, "Choisissez un fichier."),
  sizeKo: z.number().int().positive("Choisissez un fichier.").max(MAX_FILE_KO, "10 Mo au maximum."),
});
export type DocumentInput = z.infer<typeof documentInputSchema>;

export const preferencesInputSchema = z.array(
  z.object({ id: z.string().min(1), email: z.boolean(), push: z.boolean() }),
);
export type PreferencesInput = z.infer<typeof preferencesInputSchema>;
