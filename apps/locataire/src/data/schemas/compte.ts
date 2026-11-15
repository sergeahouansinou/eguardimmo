import { z } from 'zod';
import { isoDate, requiredText } from './common';

export const profileSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  profession: z.string(),
  mobile: z.string(),
  email: z.email(),
  tenantSince: isoDate,
  bankHolder: z.string(),
  bankLast4: z.string().nullable(),
  photoName: z.string().nullable(),
  dataExportRequestedOn: isoDate.nullable(),
});
export type Profile = z.infer<typeof profileSchema>;

export const profileInputSchema = z.object({
  firstName: requiredText('Le prénom', 60),
  lastName: requiredText('Le nom', 60),
  profession: z.string().trim().max(100, 'La profession est trop longue.'),
  mobile: z
    .string()
    .trim()
    .regex(/^\+?[0-9][0-9 ]{7,17}$/, 'Saisissez un numéro valide, par exemple +33 6 12 34 56 78.'),
  email: z.email('Saisissez une adresse e-mail valide.'),
  bankHolder: requiredText('Le titulaire du compte', 80),
  photoName: z.string().max(160).nullable(),
});
export type ProfileInput = z.infer<typeof profileInputSchema>;

export const CODE_PATTERN = /^\d{6}$/;
export const codeSchema = z.string().trim().regex(CODE_PATTERN, 'Le code comporte 6 chiffres.');

export const preferenceSchema = z.object({
  id: z.string(),
  label: z.string(),
  detail: z.string(),
  email: z.boolean(),
  push: z.boolean(),
});
export type Preference = z.infer<typeof preferenceSchema>;

export const preferenceInputSchema = z.object({
  id: z.string(),
  channel: z.enum(['email', 'push']),
  enabled: z.boolean(),
});
export type PreferenceInput = z.infer<typeof preferenceInputSchema>;

export const securitySchema = z.object({
  passwordChangedOn: isoDate,
  passwordStrength: z.string(),
  twoFactor: z.object({ enabled: z.boolean(), method: z.string(), backupCodesLeft: z.number().int(), backupCodesTotal: z.number().int() }),
  google: z.boolean(),
  apple: z.boolean(),
  devices: z.number().int(),
});
export type Security = z.infer<typeof securitySchema>;

export const messagePreviewSchema = z.object({
  id: z.string(),
  title: z.string(),
  date: isoDate,
  sender: z.string(),
  state: z.enum(['a_repondre', 'lu']),
});
export type MessagePreview = z.infer<typeof messagePreviewSchema>;

export const homeSchema = z.object({
  today: isoDate,
  arrearsNote: z.string(),
  messages: z.array(messagePreviewSchema),
});
export type HomeExtras = z.infer<typeof homeSchema>;
