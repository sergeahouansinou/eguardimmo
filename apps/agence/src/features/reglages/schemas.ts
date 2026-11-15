import { z } from "zod";
import { fileMetaSchema } from "@/features/kit/serverValidation";
import { isIsoDate } from "@/features/shared/dates";
import { parseMoney } from "@/features/shared/money";
import { isValidFrenchIban, isValidSiren, parseRateBp } from "./logic";

export const LEGAL_FORMS = ["SARL", "SAS", "SASU", "EURL", "SA", "SCI", "Entreprise individuelle"] as const;

export const identitySchema = z.object({
  companyName: z.string(),
  legalForm: z.enum(LEGAL_FORMS),
  siren: z.string(),
  capitalMinor: z.number().int().nonnegative().nullable(),
  address: z.string(),
  postalCode: z.string(),
  city: z.string(),
  phone: z.string(),
  email: z.string(),
  logoName: z.string(),
  signatureName: z.string(),
});

export type Identity = z.infer<typeof identitySchema>;

const requiredText = (label: string, max = 120) => z.string().trim().min(1, `${label} est obligatoire.`).max(max, `${String(max)} caractères au maximum.`);

const moneyText = z.string().refine((value) => value.trim() === "" || parseMoney(value) !== null, "Saisissez un montant valide, par exemple 20 000.");

export const identityFormSchema = z.object({
  companyName: requiredText("La raison sociale"),
  legalForm: z.enum(LEGAL_FORMS, { error: "Choisissez la forme juridique." }),
  siren: z
    .string()
    .trim()
    .min(1, "Le SIREN est obligatoire.")
    .refine((value) => /^[\d\s]+$/.test(value) && value.replace(/\s/g, "").length === 9, "Le SIREN comporte 9 chiffres.")
    .refine((value) => isValidSiren(value), "Ce SIREN n’est pas valide (clé de contrôle)."),
  capital: moneyText,
  address: requiredText("L’adresse", 160),
  postalCode: z.string().trim().regex(/^\d{5}$/, "Le code postal comporte 5 chiffres."),
  city: requiredText("La ville", 80),
  phone: z.string().trim().regex(/^\+?[\d\s.()-]{8,20}$/, "Saisissez un numéro de téléphone valide."),
  email: z.string().trim().min(1, "L’e-mail de contact est obligatoire.").pipe(z.email("Saisissez une adresse e-mail valide.")),
});

export type IdentityForm = z.infer<typeof identityFormSchema>;

export const identityInputSchema = z.object({
  companyName: requiredText("La raison sociale"),
  legalForm: z.enum(LEGAL_FORMS),
  siren: identityFormSchema.shape.siren,
  capitalMinor: z.number().int().nonnegative().max(100_000_000_000).nullable(),
  address: requiredText("L’adresse", 160),
  postalCode: z.string().trim().regex(/^\d{5}$/, "Le code postal comporte 5 chiffres."),
  city: requiredText("La ville", 80),
  phone: identityFormSchema.shape.phone,
  email: identityFormSchema.shape.email,
  logo: fileMetaSchema.nullable(),
  signature: fileMetaSchema.nullable(),
});

export const FEE_BASES = [
  { value: "rents_collected", label: "Loyers encaissés" },
  { value: "rents_charges_collected", label: "Loyers et charges encaissés" },
  { value: "rents_billed", label: "Loyers appelés" },
] as const;

export const VAT_OPTIONS = [
  { value: "0", label: "Non applicable, 0 %" },
  { value: "550", label: "5,5 %" },
  { value: "1000", label: "10 %" },
  { value: "2000", label: "20 %" },
] as const;

const feeBasisValues = ["rents_collected", "rents_charges_collected", "rents_billed"] as const;

export const financesSchema = z.object({
  feeRateBp: z.number().int(),
  feeBasis: z.enum(feeBasisValues),
  vatBp: z.number().int(),
  minFeeMinor: z.number().int().nonnegative(),
  payoutDay: z.number().int().min(1).max(28),
  retainFees: z.boolean(),
  attachReport: z.boolean(),
  worksCeilingMinor: z.number().int().nonnegative(),
  account: z.object({
    ibanMasked: z.string(),
    last4: z.string(),
    bank: z.string(),
    holder: z.string(),
    reconciledOn: z.string().refine(isIsoDate).nullable(),
  }),
});

export type Finances = z.infer<typeof financesSchema>;

export const financesFormSchema = z.object({
  feeRate: z
    .string()
    .refine((value) => parseRateBp(value) !== null, "Saisissez un taux valide, par exemple 7.")
    .refine((value) => {
      const bp = parseRateBp(value);
      return bp === null || (bp > 0 && bp <= 2500);
    }, "Le taux doit être compris entre 0,01 % et 25 %."),
  feeBasis: z.enum(feeBasisValues, { error: "Choisissez la base de calcul." }),
  vat: z.enum(["0", "550", "1000", "2000"], { error: "Choisissez la TVA applicable." }),
  minFee: z.string().refine((value) => parseMoney(value) !== null, "Saisissez un montant valide, par exemple 15,00."),
  payoutDay: z.string().min(1, "Choisissez le jour de reversement."),
  retainFees: z.boolean(),
  attachReport: z.boolean(),
  worksCeiling: z.string().refine((value) => parseMoney(value) !== null, "Saisissez un montant valide, par exemple 300."),
});

export type FinancesForm = z.infer<typeof financesFormSchema>;

export const financesInputSchema = z.object({
  feeRateBp: z.number().int().min(1).max(2500),
  feeBasis: z.enum(feeBasisValues),
  vatBp: z.union([z.literal(0), z.literal(550), z.literal(1000), z.literal(2000)]),
  minFeeMinor: z.number().int().nonnegative().max(1_000_000),
  payoutDay: z.number().int().min(1).max(28),
  retainFees: z.boolean(),
  attachReport: z.boolean(),
  worksCeilingMinor: z.number().int().nonnegative().max(100_000_000),
});

export const accountFormSchema = z.object({
  iban: z
    .string()
    .trim()
    .min(1, "L’IBAN est obligatoire.")
    .refine((value) => isValidFrenchIban(value), "Cet IBAN n’est pas valide (IBAN français, clé de contrôle)."),
  bank: requiredText("La banque", 80),
  holder: requiredText("Le titulaire", 120),
});

export type AccountForm = z.infer<typeof accountFormSchema>;
