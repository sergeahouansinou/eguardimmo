import { z } from "zod";

export const NAME_MIN = 2;
export const NAME_MAX = 120;
export const PHONE_MAX = 32;
export const CODE_LENGTH = 6;

const FORBIDDEN_CHARACTERS = /[\u0000-\u001F\u007F<>]/;

export const nameFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(NAME_MIN, `Indiquez votre nom (${String(NAME_MIN)} caractères au minimum).`)
    .max(NAME_MAX, `Votre nom est trop long (${String(NAME_MAX)} caractères au maximum).`)
    .refine((value) => !FORBIDDEN_CHARACTERS.test(value), "Votre nom contient un caractère non autorisé."),
});

export const phoneFormSchema = z.object({
  phone: z
    .string()
    .trim()
    .max(PHONE_MAX, `Le numéro est trop long (${String(PHONE_MAX)} caractères au maximum).`)
    .refine((value) => !FORBIDDEN_CHARACTERS.test(value), "Le numéro contient un caractère non autorisé."),
});

export const emailFormSchema = z.object({
  email: z.string().trim().max(254, "Cette adresse est trop longue.").pipe(z.email("Saisissez une adresse e-mail valide.")),
});

export const codeFormSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(new RegExp(`^\\d{${String(CODE_LENGTH)}}$`), `Saisissez le code à ${String(CODE_LENGTH)} chiffres reçu par e-mail.`),
});

export type NameValues = z.input<typeof nameFormSchema>;
export type PhoneValues = z.input<typeof phoneFormSchema>;
export type EmailValues = z.input<typeof emailFormSchema>;
export type CodeValues = z.input<typeof codeFormSchema>;
