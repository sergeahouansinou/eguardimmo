import { z } from "zod";
import { DEMO_TODAY, addMonths, isIsoDate } from "@/features/shared/dates";
import { parseMoney } from "@/features/shared/money";
import { parseBasisPoints } from "../format";
import { feeBaseSchema, feeCollectionSchema } from "../inputs";
import type { BaremeInput } from "../inputs";

const PERCENT = /^\d{1,3}(?:[.,]\d{1,2})?$/;

function percentValue(text: string): number | null {
  const compact = text.replace(/[\s%]/g, "");
  return PERCENT.test(compact) ? Number(compact.replace(",", ".")) : null;
}

export const baremeFormSchema = z.object({
  mandantId: z.string().min(1, "Choisissez un mandat."),
  rate: z
    .string()
    .trim()
    .refine((value) => {
      const basisPoints = parseBasisPoints(value);
      return basisPoints !== null && basisPoints > 0 && basisPoints <= 2500;
    }, "Saisissez un taux entre 0,01 et 25. Exemple : 7,00."),
  base: feeBaseSchema,
  minFee: z
    .string()
    .trim()
    .refine((value) => parseMoney(value) !== null, "Montant invalide. Exemple : 0,00."),
  collection: feeCollectionSchema,
  relocation: z
    .string()
    .trim()
    .refine((value) => (percentValue(value) ?? 101) <= 100, "Saisissez un pourcentage entre 0 et 100. Exemple : 50."),
  works: z
    .string()
    .trim()
    .refine((value) => {
      const basisPoints = parseBasisPoints(value);
      return basisPoints !== null && basisPoints <= 1500;
    }, "Saisissez un pourcentage entre 0 et 15. Exemple : 5,00."),
  effectiveFrom: z
    .string()
    .refine(isIsoDate, "Saisissez une date valide.")
    .refine((value) => value > DEMO_TODAY, "L'entrée en vigueur doit être postérieure à aujourd'hui."),
  applyToAll: z.boolean(),
});

export type BaremeFormInput = z.input<typeof baremeFormSchema>;
export type BaremeFormValues = z.output<typeof baremeFormSchema>;

export function toBaremeInput(values: BaremeFormInput): BaremeInput | null {
  const rateBp = parseBasisPoints(values.rate);
  const minFeeMinor = parseMoney(values.minFee);
  const relocationPercent = percentValue(values.relocation);
  const worksBp = parseBasisPoints(values.works);
  if (rateBp === null || minFeeMinor === null || relocationPercent === null || worksBp === null || values.mandantId === "") return null;
  return {
    mandantId: values.mandantId,
    rateBp,
    base: values.base,
    minFeeMinor,
    collection: values.collection,
    relocationPercent,
    worksBp,
    effectiveFrom: isIsoDate(values.effectiveFrom) ? values.effectiveFrom : addMonths(DEMO_TODAY, 1),
    applyToAll: values.applyToAll,
  };
}
