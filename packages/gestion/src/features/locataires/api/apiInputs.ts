import { z } from 'zod';
import { CONTACT_POINT_TYPES, IDENTIFIER_SCHEMES } from './apiSchemas';

const IBAN_PATTERN = /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/;
const BIC_PATTERN = /^[A-Za-z]{6}[A-Za-z0-9]{2}([A-Za-z0-9]{3})?$/;
const COUNTRY_PATTERN = /^[A-Z]{2}$/;
const text = z.string().trim();
const coordinate = text.min(1, 'Renseignez la coordonnée').max(254, 'Coordonnée trop longue');
const identifierValue = text.min(1, 'Renseignez le numéro').max(60, 'Numéro trop long');
const country = z.string().regex(COUNTRY_PATTERN, 'Pays en deux lettres majuscules, ex. FR');

export const contactPointInputSchema = z.object({
  type: z.enum(CONTACT_POINT_TYPES),
  value: coordinate,
  label: text.max(60, 'Libellé trop long').optional(),
  primary: z.boolean().optional(),
});
export type ContactPointInput = z.input<typeof contactPointInputSchema>;

export const contactPointChangesSchema = z.object({
  value: coordinate.optional(),
  label: text.max(60, 'Libellé trop long').nullable().optional(),
  primary: z.literal(true).optional(),
});
export type ContactPointChanges = z.input<typeof contactPointChangesSchema>;

export const identifierInputSchema = z.object({ scheme: z.enum(IDENTIFIER_SCHEMES), country, value: identifierValue });
export type IdentifierInput = z.input<typeof identifierInputSchema>;

export const identifierChangesSchema = z.object({ country: country.optional(), value: identifierValue.optional() });
export type IdentifierChanges = z.input<typeof identifierChangesSchema>;

export const bankAccountInputSchema = z.object({
  iban: z
    .string()
    .transform((value) => value.replace(/\s+/g, '').toUpperCase())
    .pipe(z.string().regex(IBAN_PATTERN, 'IBAN incomplet ou invalide, ex. FR76 3000 6000 0112 3456 7890 189')),
  bic: z.union([z.literal(''), text.regex(BIC_PATTERN, 'BIC invalide, ex. AGRIFRPP')]).optional(),
  holderName: text.min(1, 'Renseignez le titulaire').max(200, 'Nom trop long'),
  validFrom: z.iso.date().optional(),
});
export type BankAccountInput = z.input<typeof bankAccountInputSchema>;
