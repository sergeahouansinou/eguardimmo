import { z } from "zod";
import { CURRENCIES } from "@/lib/currency";
import type { Currency } from "@/lib/currency";
import { fileMetaSchema } from "@/features/kit/serverValidation";
import { isIsoDate } from "@/features/shared/dates";
import { parseMoney } from "@/features/shared/money";
import { isValidIban, isValidSiren, parseRateBp } from "./logic";

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
  { value: "rent", label: "Loyer hors charges" },
  { value: "rent_and_charges", label: "Loyer et charges" },
] as const;

export const FEE_TAX_MODES = [
  { value: "excl_tax", label: "Hors taxes (la taxe s’ajoute)" },
  { value: "incl_tax", label: "Toutes taxes comprises" },
] as const;

const feeBasisValues = ["rent", "rent_and_charges"] as const;
const feeTaxModeValues = ["excl_tax", "incl_tax"] as const;

export const financesSchema = z.object({
  currency: z.enum(CURRENCIES),
  feeRateBp: z.number().int(),
  feeBasis: z.enum(feeBasisValues),
  feeTaxMode: z.enum(feeTaxModeValues),
  minFeeMinor: z.number().int().nonnegative(),
  payoutDay: z.number().int().min(1).max(28),
  worksCeilingMinor: z.number().int().nonnegative(),
  vat: z.object({ regime: z.enum(["normal", "franchise"]), rateBp: z.number().int().nonnegative() }),
  account: z.object({
    ibanMasked: z.string(),
    last4: z.string(),
    bank: z.string(),
    holder: z.string(),
    reconciledOn: z.string().refine(isIsoDate).nullable(),
  }),
});

export type Finances = z.infer<typeof financesSchema>;

const MIN_FEE_EXAMPLES: Readonly<Record<Currency, string>> = { EUR: "15,00", XOF: "5 000" };
const WORKS_CEILING_EXAMPLES: Readonly<Record<Currency, string>> = { EUR: "300", XOF: "250 000" };

export const makeFinancesFormSchema = (currency: Currency) => z.object({
  feeRate: z
    .string()
    .refine((value) => parseRateBp(value) !== null, "Saisissez un taux valide, par exemple 7.")
    .refine((value) => {
      const bp = parseRateBp(value);
      return bp === null || (bp > 0 && bp <= 2500);
    }, "Le taux doit être compris entre 0,01 % et 25 %."),
  feeBasis: z.enum(feeBasisValues, { error: "Choisissez la base de calcul." }),
  feeTaxMode: z.enum(feeTaxModeValues, { error: "Indiquez si les honoraires s’entendent hors taxes ou toutes taxes comprises." }),
  minFee: z.string().refine((value) => parseMoney(value, currency) !== null, `Saisissez un montant valide, par exemple ${MIN_FEE_EXAMPLES[currency]}.`),
  payoutDay: z.string().min(1, "Choisissez le jour de reversement."),
  worksCeiling: z.string().refine((value) => parseMoney(value, currency) !== null, `Saisissez un montant valide, par exemple ${WORKS_CEILING_EXAMPLES[currency]}.`),
});

export type FinancesForm = z.infer<ReturnType<typeof makeFinancesFormSchema>>;

export const financesInputSchema = z.object({
  feeRateBp: z.number().int().min(1).max(2500),
  feeBasis: z.enum(feeBasisValues),
  feeTaxMode: z.enum(feeTaxModeValues),
  minFeeMinor: z.number().int().nonnegative().max(1_000_000),
  payoutDay: z.number().int().min(1).max(28),
  worksCeilingMinor: z.number().int().nonnegative().max(100_000_000),
});

export const accountFormSchema = z.object({
  iban: z
    .string()
    .trim()
    .min(1, "L’IBAN est obligatoire.")
    .refine((value) => isValidIban(value), "Cet IBAN n’est pas valide (clé de contrôle). Exemple : FR76 3000 6000 0112 3456 7890 189."),
  bank: requiredText("La banque", 80),
  holder: requiredText("Le titulaire", 120),
});

export type AccountForm = z.infer<typeof accountFormSchema>;
