import { z } from "zod";
import { IMAGE_RULES, validateFile } from "@/features/shared/files";

export const CIVILITY_OPTIONS = [
  { value: "mme", label: "Mme" },
  { value: "m", label: "M." },
  { value: "none", label: "Non précisée" },
] as const;

export const LANGUAGE_OPTIONS = [{ value: "fr", label: "Français" }] as const;

export const TIMEZONE_OPTIONS = [
  { value: "Europe/Paris", label: "Paris (UTC+1)" },
  { value: "Africa/Dakar", label: "Dakar (UTC+0)" },
  { value: "Africa/Abidjan", label: "Abidjan (UTC+0)" },
  { value: "Indian/Reunion", label: "La Réunion (UTC+4)" },
] as const;

const civilitySchema = z.enum(["mme", "m", "none"]);
const timezoneSchema = z.enum(["Europe/Paris", "Africa/Dakar", "Africa/Abidjan", "Indian/Reunion"]);

export const profileSchema = z.object({
  civility: civilitySchema,
  firstName: z.string(),
  lastName: z.string(),
  jobTitle: z.string(),
  mobile: z.string(),
  email: z.string(),
  language: z.literal("fr"),
  timezone: timezoneSchema,
  photoName: z.string().nullable(),
  roleLabel: z.string(),
});
export type Profile = z.infer<typeof profileSchema>;

export const profileInputSchema = z.object({
  civility: civilitySchema,
  firstName: z.string().trim().min(1, "Le prénom est obligatoire."),
  lastName: z.string().trim().min(1, "Le nom est obligatoire."),
  jobTitle: z.string().trim().max(80, "La fonction ne peut pas dépasser 80 caractères."),
  mobile: z
    .string()
    .trim()
    .regex(/^\+?[0-9][0-9 ]{7,17}$/, "Saisissez un numéro de mobile valide, par exemple +33 6 12 34 56 78."),
  language: z.literal("fr"),
  timezone: timezoneSchema,
  photoName: z
    .string()
    .nullable()
    .refine((name) => name === null || validateFile({ name, size: 1, type: "" }, IMAGE_RULES) === null, {
      message: "La photo doit être une image PNG ou JPG.",
    }),
});
export type ProfileInput = z.input<typeof profileInputSchema>;
export type ProfileFormValues = Omit<ProfileInput, "photoName">;

export const exportRowsSchema = z.object({
  filename: z.string(),
  header: z.array(z.string()),
  rows: z.array(z.array(z.string())),
});
