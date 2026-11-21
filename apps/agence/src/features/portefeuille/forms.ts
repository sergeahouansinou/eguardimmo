import { z } from "zod";
import { amountExample, currencyName, parseAmount, parseRateBasisPoints } from "@/lib/currency";
import type { Currency } from "@/lib/currency";
import { addMonths, addDays, formatDay, isoDayOrNull } from "@/lib/dates";
import { feeBaseSchema, feeTaxModeSchema } from "./api/apiSchemas";
import { OPTIONAL_RATE_MESSAGE, optionalRate } from "./feeTerms";
import { avenantKindSchema, mandantTypeSchema, paymentModeSchema } from "./schemas";
import type { AvenantKind } from "./schemas";

export function isValidIban(raw: string): boolean {
  const iban = raw.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const rearranged = `${iban.slice(4)}${iban.slice(0, 4)}`;
  const digits = rearranged.replace(/[A-Z]/g, (char) => String(char.charCodeAt(0) - 55));
  let remainder = 0;
  for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97;
  return remainder === 1;
}

export function parseDecimal(raw: string): number | null {
  const text = raw.trim().replace(/\s+/g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  return Number(text);
}

export function toMinor(raw: string, currency: Currency = "EUR"): number {
  const value = parseAmount(raw, currency);
  if (value === null) throw new RangeError(`Montant invalide : ${raw}`);
  return value;
}

export const amountMessage = (currency: Currency): string => `Saisissez un montant en ${currencyName(currency)}, par exemple ${amountExample(currency)}.`;

const MAX_AVENANT_RATE_BASIS_POINTS = 2000;

const required = (message: string) => z.string().trim().min(1, message);
const decimalField = (message: string) => z.string().trim().refine((value) => parseDecimal(value) !== null, message);
const optionalDate = z.string().refine((value) => value === "" || isoDayOrNull(value) !== null, "Saisissez une date valide.");

export const mandantFormSchema = z
  .object({
    type: mandantTypeSchema,
    firstName: z.string().trim(),
    lastName: z.string().trim(),
    companyName: z.string().trim(),
    profession: z.string().trim(),
    birthDate: optionalDate,
    email: z.email("Saisissez une adresse e-mail valide, par exemple claire.vasseur@example.com."),
    mobile: z.string().trim().refine((value) => value === "" || /^(\+33|0)[1-9]([\s.]?\d{2}){4}$/.test(value), "Saisissez un numéro français, par exemple 06 12 34 56 78."),
    address: z.string().trim(),
    postalCode: z.string().trim().refine((value) => value === "" || /^\d{5}$/.test(value), "Le code postal comporte 5 chiffres."),
    city: z.string().trim(),
    accountHolder: required("Indiquez le titulaire du compte."),
    iban: z.string().trim().refine(isValidIban, "Cet IBAN n'est pas valide. Vérifiez la saisie, par exemple FR76 3000 6000 0112 3456 7890 189."),
    inviteByEmail: z.boolean(),
    reportsByEmail: z.boolean(),
    idFileName: z.string(),
  })
  .superRefine((values, context) => {
    if (values.type === "particulier") {
      if (!values.firstName) context.addIssue({ code: "custom", path: ["firstName"], message: "Indiquez le prénom." });
      if (!values.lastName) context.addIssue({ code: "custom", path: ["lastName"], message: "Indiquez le nom." });
    } else if (!values.companyName) {
      context.addIssue({ code: "custom", path: ["companyName"], message: "Indiquez la dénomination." });
    }
  });
export type MandantFormValues = z.infer<typeof mandantFormSchema>;

export const lotFormSchema = z.object({
  name: required("Nommez le lot, par exemple Apt 8."),
  kind: required("Indiquez le type, par exemple T3."),
  surface: decimalField("Indiquez la surface en m², par exemple 40."),
  street: required("Indiquez l'adresse, par exemple 40 rue de Brest."),
  postalCode: z.string().trim().regex(/^\d{5}$/, "Le code postal comporte 5 chiffres."),
  city: required("Indiquez la ville, par exemple Lyon."),
});
export type LotFormValues = z.infer<typeof lotFormSchema>;

export const mandatFormSchema = z
  .object({
    mandantId: required("Choisissez le mandant."),
    lots: z.array(lotFormSchema).min(1, "Confiez au moins un lot."),
    feePercent: z.string().trim().refine((value) => {
      const parsed = parseRateBasisPoints(value);
      return parsed !== null && parsed > 0 && parsed <= MAX_AVENANT_RATE_BASIS_POINTS;
    }, "Saisissez un taux entre 0,01 et 20 %, par exemple 7,00."),
    payoutDay: z.string().regex(/^(?:[1-9]|1\d|2[0-8])$/, "Choisissez un jour entre 1 et 28."),
    worksLimit: decimalField("Saisissez un montant en euros, par exemple 500."),
    startIso: z.string().refine((value) => isoDayOrNull(value) !== null, "Indiquez la date de prise d'effet."),
    endIso: z.string().refine((value) => isoDayOrNull(value) !== null, "Indiquez l'échéance."),
    renewal: z.enum(["aucune", "tacite"]),
    signedFileName: z.string(),
  })
  .superRefine((values, context) => {
    if (isoDayOrNull(values.startIso) && isoDayOrNull(values.endIso) && values.endIso <= values.startIso) {
      context.addIssue({ code: "custom", path: ["endIso"], message: "L'échéance doit suivre la prise d'effet." });
    }
  });
export type MandatFormValues = z.infer<typeof mandatFormSchema>;

export const BAIL_KINDS = [
  { value: "vide-3", label: "Location vide, 3 ans", furnished: false, months: 36 },
  { value: "vide-6", label: "Location vide, 6 ans (bailleur société)", furnished: false, months: 72 },
  { value: "meuble-1", label: "Location meublée, 1 an", furnished: true, months: 12 },
] as const;

export type BailKindValue = (typeof BAIL_KINDS)[number]["value"];

export function bailKindOf(value: string): (typeof BAIL_KINDS)[number] {
  return BAIL_KINDS.find((kind) => kind.value === value) ?? BAIL_KINDS[0];
}

export function bailEndIso(startIso: string, kind: BailKindValue): string {
  return addDays(addMonths(startIso, bailKindOf(kind).months), -1);
}

export interface BailFormContext {
  occupiedUntil: Readonly<Record<string, string>>;
}

export function makeBailFormSchema(context: BailFormContext) {
  return z
    .object({
      bienId: required("Choisissez le lot."),
      locataireId: required("Choisissez le locataire."),
      startIso: z.string().refine((value) => isoDayOrNull(value) !== null, "Indiquez la date de début."),
      kind: z.enum(["vide-3", "vide-6", "meuble-1"]),
      rent: decimalField("Saisissez le loyer hors charges, par exemple 620."),
      charges: decimalField("Saisissez les provisions, par exemple 60 (0 si aucune)."),
      deposit: decimalField("Saisissez le dépôt de garantie, par exemple 620 (0 si aucun)."),
      dueDay: z.string().regex(/^(?:[1-9]|1\d|2[0-8])$/, "Choisissez un jour entre 1 et 28."),
      paymentMode: paymentModeSchema,
      note: z.string().trim().max(500, "La note ne dépasse pas 500 caractères."),
    })
    .superRefine((values, ctx) => {
      const until = context.occupiedUntil[values.bienId];
      if (until && isoDayOrNull(values.startIso) && values.startIso <= until) {
        ctx.addIssue({
          code: "custom",
          path: ["startIso"],
          message: `Ce lot est occupé jusqu'au ${formatDay(until)}. Le bail commence après cette date.`,
        });
      }
      const rent = parseDecimal(values.rent);
      const deposit = parseDecimal(values.deposit);
      if (rent !== null && deposit !== null) {
        const cap = bailKindOf(values.kind).furnished ? rent * 2 : rent;
        if (deposit > cap) {
          ctx.addIssue({
            code: "custom",
            path: ["deposit"],
            message: bailKindOf(values.kind).furnished
              ? "Le dépôt de garantie ne dépasse pas 2 mois de loyer hors charges."
              : "Le dépôt de garantie ne dépasse pas 1 mois de loyer hors charges.",
          });
        }
      }
    });
}
export type BailFormValues = z.infer<ReturnType<typeof makeBailFormSchema>>;

export const TERMINATION_REASONS = [
  { value: "mandant", label: "Résiliation à l'initiative du mandant" },
  { value: "agence", label: "Résiliation à l'initiative de l'agence" },
  { value: "vente", label: "Vente des biens" },
  { value: "accord", label: "Accord amiable des parties" },
] as const;

export const TERMINATION_NOTICE_MONTHS = 3;

export function makeTerminationFormSchema(todayIso: string, noticeMonths: number = TERMINATION_NOTICE_MONTHS) {
  const earliest = addMonths(todayIso, noticeMonths);
  return z
    .object({
      reason: z.enum(["mandant", "agence", "vente", "accord"]),
      effectIso: z.string().refine((value) => isoDayOrNull(value) !== null, "Indiquez la date d'effet."),
      note: z.string().trim().max(500, "Les observations ne dépassent pas 500 caractères."),
    })
    .superRefine((values, ctx) => {
      if (values.reason !== "accord" && isoDayOrNull(values.effectIso) && values.effectIso < earliest) {
        ctx.addIssue({
          code: "custom",
          path: ["effectIso"],
          message: `Le préavis est de ${String(noticeMonths)} mois : la date d'effet est au plus tôt le ${formatDay(earliest)}.`,
        });
      }
    });
}
export type TerminationFormValues = z.infer<ReturnType<typeof makeTerminationFormSchema>>;

export const bienFormSchema = z.object({
  mandatId: required("Choisissez le mandat."),
  name: required("Nommez le lot, par exemple Apt 8."),
  kind: required("Indiquez le type, par exemple T3."),
  surface: decimalField("Indiquez la surface en m², par exemple 40.").refine((value) => (parseDecimal(value) ?? 0) > 0, "La surface est supérieure à 0 m²."),
  street: required("Indiquez l'adresse, par exemple 40 rue de Brest."),
  postalCode: z.string().trim().regex(/^\d{5}$/, "Le code postal comporte 5 chiffres, par exemple 69002."),
  city: required("Indiquez la ville, par exemple Lyon."),
  floor: z.string().trim().max(80, "L'étage ne dépasse pas 80 caractères."),
  dpe: z.string().trim().max(80, "Le DPE ne dépasse pas 80 caractères."),
  heating: z.string().trim().max(80, "Le chauffage ne dépasse pas 80 caractères."),
  syndic: z.string().trim().max(80, "Le syndic ne dépasse pas 80 caractères."),
  propertyTax: z.string().trim().max(80, "La taxe foncière ne dépasse pas 80 caractères."),
  rent: decimalField("Saisissez le loyer hors charges visé, par exemple 620.").refine((value) => (parseDecimal(value) ?? 0) > 0, "Le loyer est supérieur à 0 €."),
  charges: decimalField("Saisissez les provisions sur charges, par exemple 60 (0 si aucune)."),
});
export type BienFormValues = z.infer<typeof bienFormSchema>;

export const AVENANT_KINDS: readonly { value: AvenantKind; label: string; description: string }[] = [
  { value: "honoraires", label: "Honoraires", description: "Nouveau taux, calculé sur les loyers encaissés" },
  { value: "duree", label: "Durée", description: "Prolongation, nouvelle échéance du mandat" },
  { value: "reversement", label: "Reversement", description: "Nouveau jour de virement au mandant" },
  { value: "travaux", label: "Travaux", description: "Nouveau plafond de travaux sans accord" },
];

export interface AvenantFormContext {
  todayIso: string;
  endIsoByMandat: Readonly<Record<string, string>>;
  currencyByMandat?: Readonly<Record<string, Currency>>;
  api?: boolean;
}

export function makeAvenantFormSchema(context: AvenantFormContext) {
  return z
    .object({
      mandatId: required("Choisissez le mandat."),
      kind: avenantKindSchema,
      effectIso: z.string().refine((value) => isoDayOrNull(value) !== null, "Indiquez la date d'effet."),
      feePercent: z.string().trim(),
      endIso: z.string(),
      payoutDay: z.string(),
      worksLimit: z.string().trim(),
      feeBase: z.string(),
      feeMinimum: z.string().trim(),
      feeTaxMode: z.string(),
      lettingRate: z.string().trim(),
      worksFeeRate: z.string().trim(),
      note: z.string().trim().max(500, "Le motif ne dépasse pas 500 caractères."),
    })
    .superRefine((values, ctx) => {
      const currency = context.currencyByMandat?.[values.mandatId] ?? "EUR";
      if (isoDayOrNull(values.effectIso) && values.effectIso < context.todayIso) {
        ctx.addIssue({ code: "custom", path: ["effectIso"], message: `La date d'effet ne peut pas être antérieure au ${formatDay(context.todayIso)}.` });
      }
      if (values.kind === "honoraires") {
        const rate = parseRateBasisPoints(values.feePercent);
        if (rate === null || rate <= 0 || rate > MAX_AVENANT_RATE_BASIS_POINTS) {
          ctx.addIssue({ code: "custom", path: ["feePercent"], message: "Saisissez un taux entre 0,01 et 20 %, par exemple 6,50." });
        }
        if (context.api === true) {
          if (!feeBaseSchema.safeParse(values.feeBase).success) ctx.addIssue({ code: "custom", path: ["feeBase"], message: "Choisissez la base de calcul des honoraires." });
          if (parseAmount(values.feeMinimum, currency) === null) ctx.addIssue({ code: "custom", path: ["feeMinimum"], message: `Saisissez le minimum par mois en ${currencyName(currency)}, 0 si aucun.` });
          if (!feeTaxModeSchema.safeParse(values.feeTaxMode).success) ctx.addIssue({ code: "custom", path: ["feeTaxMode"], message: "Indiquez si les honoraires s'entendent hors taxes ou toutes taxes comprises." });
          if (optionalRate(values.lettingRate) === undefined) ctx.addIssue({ code: "custom", path: ["lettingRate"], message: OPTIONAL_RATE_MESSAGE });
          if (optionalRate(values.worksFeeRate) === undefined) ctx.addIssue({ code: "custom", path: ["worksFeeRate"], message: OPTIONAL_RATE_MESSAGE });
        }
      }
      if (values.kind === "duree") {
        const current = context.endIsoByMandat[values.mandatId];
        if (isoDayOrNull(values.endIso) === null) {
          ctx.addIssue({ code: "custom", path: ["endIso"], message: "Indiquez la nouvelle échéance." });
        } else if (current && values.endIso <= current) {
          ctx.addIssue({ code: "custom", path: ["endIso"], message: `La nouvelle échéance doit suivre l'échéance actuelle du ${formatDay(current)}.` });
        }
      }
      if (values.kind === "reversement" && !/^(?:[1-9]|1\d|2[0-8])$/.test(values.payoutDay)) {
        ctx.addIssue({ code: "custom", path: ["payoutDay"], message: "Choisissez un jour entre 1 et 28." });
      }
      if (values.kind === "travaux" && parseAmount(values.worksLimit, currency) === null) {
        ctx.addIssue({ code: "custom", path: ["worksLimit"], message: amountMessage(currency) });
      }
    });
}
export type AvenantFormValues = z.infer<ReturnType<typeof makeAvenantFormSchema>>;

export const invitationFormSchema = z.object({
  email: z.email("Saisissez une adresse e-mail valide, par exemple chloe.martin@example.com."),
  bailId: required("Choisissez le bail concerné."),
  message: z.string().trim().min(10, "Rédigez un message d'au moins 10 caractères.").max(500, "Le message ne dépasse pas 500 caractères."),
});
export type InvitationFormValues = z.infer<typeof invitationFormSchema>;

export const DEFAULT_INVITATION_MESSAGE = "Bonjour, activez votre espace locataire pour suivre vos loyers, télécharger vos quittances et échanger avec l'agence.";
