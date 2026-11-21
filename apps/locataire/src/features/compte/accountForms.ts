import { z } from 'zod';
import { hasForbiddenCharacter, isDigits } from '@/tenant/apiKit';

export const PHONE_MAX = 32;
export const CODE_LENGTH = 6;

export const nameFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Indiquez votre nom (2 caractères au minimum).')
    .max(120, 'Votre nom est trop long (120 caractères au maximum).')
    .refine((value) => !hasForbiddenCharacter(value), 'Votre nom contient un caractère non autorisé.'),
});

export const phoneFormSchema = z.object({
  phone: z
    .string()
    .trim()
    .max(PHONE_MAX, `Le numéro est trop long (${String(PHONE_MAX)} caractères au maximum).`)
    .refine((value) => !hasForbiddenCharacter(value), 'Le numéro contient un caractère non autorisé.'),
});

export const emailFormSchema = z.object({
  email: z.string().trim().max(254, 'Cette adresse est trop longue.').pipe(z.email('Saisissez une adresse e-mail valide.')),
});

export const codeFormSchema = z.object({
  code: z
    .string()
    .trim()
    .refine((value) => isDigits(value, CODE_LENGTH), `Saisissez le code à ${String(CODE_LENGTH)} chiffres reçu par e-mail.`),
});

export type NameValues = z.input<typeof nameFormSchema>;
export type PhoneValues = z.input<typeof phoneFormSchema>;
export type EmailValues = z.input<typeof emailFormSchema>;
export type CodeValues = z.input<typeof codeFormSchema>;
