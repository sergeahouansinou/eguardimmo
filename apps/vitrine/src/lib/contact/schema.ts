import { z } from "zod";

export const CONTACT_PROFILES = ["agence", "proprietaire", "locataire", "autre"] as const;

export const CONTACT_PROFILE_LABELS: Record<(typeof CONTACT_PROFILES)[number], string> = {
  agence: "Agence",
  proprietaire: "Propriétaire",
  locataire: "Locataire",
  autre: "Autre",
};

export const MAX_BODY_BYTES = 8 * 1024;

const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

const text = (label: string, min: number, max: number) =>
  z
    .string({ error: `${label} est obligatoire.` })
    .trim()
    .min(min, `${label} est obligatoire.`)
    .max(max, `${label} ne doit pas dépasser ${String(max)} caractères.`)
    .refine((value) => !CONTROL_CHARACTERS.test(value), `${label} contient des caractères non autorisés.`);

export const contactSchema = z.strictObject({
  organisation: text("Le nom de l’organisation", 2, 120),
  email: z
    .string({ error: "L’adresse e-mail est obligatoire." })
    .trim()
    .min(1, "L’adresse e-mail est obligatoire.")
    .max(254, "L’adresse e-mail ne doit pas dépasser 254 caractères.")
    .pipe(z.email("Saisissez une adresse e-mail valide.")),
  profil: z.enum(CONTACT_PROFILES, { error: "Choisissez votre profil." }),
  message: z
    .string()
    .trim()
    .max(1000, "Le message ne doit pas dépasser 1000 caractères.")
    .refine((value) => !CONTROL_CHARACTERS.test(value.replace(/[\n\r\t]/g, "")), "Le message contient des caractères non autorisés.")
    .optional(),
  consentement: z.literal(true, { error: "Vous devez accepter le traitement de votre demande pour l’envoyer." }),
  siteWeb: z.string().max(0).optional(),
});

export type ContactInput = z.infer<typeof contactSchema>;

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !(key in errors)) errors[key] = issue.message;
  }
  return errors;
}
