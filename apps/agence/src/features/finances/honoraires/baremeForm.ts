import { z } from "zod";
import { DEMO_TODAY, addDays, isIsoDate } from "@/features/shared/dates";
import { parseMoney } from "@/features/shared/money";
import { parseRateBasisPoints } from "@/lib/currency";
import { feeBaseSchema } from "../inputs";
import type { BaremeInput } from "../inputs";

const MAX_RATE_BP = 2500;
const MAX_LETTING_BP = 10_000;
const MAX_WORKS_BP = 1500;

function rateWithin(max: number, min: number) {
  return (value: string): boolean => {
    const basisPoints = parseRateBasisPoints(value);
    return basisPoints !== null && basisPoints >= min && basisPoints <= max;
  };
}

export const baremeFormSchema = z.object({
  mandateId: z.string().min(1, "Choisissez un mandat."),
  rate: z.string().trim().refine(rateWithin(MAX_RATE_BP, 1), "Saisissez un taux entre 0,01 et 25. Exemple : 7,00."),
  base: feeBaseSchema,
  minFee: z
    .string()
    .trim()
    .refine((value) => parseMoney(value) !== null, "Montant invalide. Exemple : 0,00."),
  letting: z.string().trim().refine(rateWithin(MAX_LETTING_BP, 0), "Saisissez un pourcentage entre 0 et 100. Exemple : 50."),
  works: z.string().trim().refine(rateWithin(MAX_WORKS_BP, 0), "Saisissez un pourcentage entre 0 et 15. Exemple : 5,00."),
  effectiveFrom: z
    .string()
    .refine(isIsoDate, "Saisissez une date valide.")
    .refine((value) => value >= DEMO_TODAY, "L'entrée en vigueur ne peut pas être antérieure à aujourd'hui."),
});

export type BaremeFormInput = z.input<typeof baremeFormSchema>;
export type BaremeFormValues = z.output<typeof baremeFormSchema>;

export function toBaremeInput(values: BaremeFormInput): BaremeInput | null {
  const rateBp = parseRateBasisPoints(values.rate);
  const minFeeMinor = parseMoney(values.minFee);
  const lettingBp = parseRateBasisPoints(values.letting);
  const worksBp = parseRateBasisPoints(values.works);
  if (rateBp === null || minFeeMinor === null || lettingBp === null || worksBp === null || values.mandateId === "") return null;
  return {
    mandateId: values.mandateId,
    rateBp,
    base: values.base,
    minFeeMinor,
    lettingBp,
    worksBp,
    effectiveFrom: isIsoDate(values.effectiveFrom) ? values.effectiveFrom : addDays(DEMO_TODAY, 1),
  };
}
