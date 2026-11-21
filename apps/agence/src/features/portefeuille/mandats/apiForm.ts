import { z } from "zod";
import { CURRENCIES, parseRateBasisPoints } from "@/lib/currency";
import { isoDayOrNull } from "@/lib/dates";
import { feeBaseSchema, feeTaxModeSchema } from "../api/apiSchemas";
import { optionalRate } from "../feeTerms";
import { toMinor } from "../forms";
import { addTermIssues } from "../termsForm";
import type { NewMandat } from "../source";

const required = (message: string) => z.string().trim().min(1, message);

export const mandatApiFormSchema = z
  .object({
    mandantId: required("Choisissez le mandant."),
    typeId: required("Choisissez le type de mandat."),
    units: z.array(z.object({ unitId: z.string() })).min(1, "Confiez au moins un lot."),
    currency: z.enum(CURRENCIES),
    feeKind: z.enum(["percentage", "flat"]),
    feePercent: z.string().trim(),
    flatFee: z.string().trim(),
    feeBase: z.union([z.literal(""), feeBaseSchema]).refine((value): boolean => value !== "", "Choisissez la base de calcul des honoraires."),
    feeMinimum: z.string().trim(),
    feeTaxMode: z.enum(feeTaxModeSchema.options, "Indiquez si les honoraires s'entendent hors taxes ou toutes taxes comprises."),
    payoutDay: z.string().regex(/^(?:[1-9]|1\d|2[0-8])$/, "Choisissez un jour entre 1 et 28."),
    worksLimit: z.string().trim(),
    lettingRate: z.string().trim(),
    worksFeeRate: z.string().trim(),
    startIso: z.string().refine((value) => isoDayOrNull(value) !== null, "Indiquez la date de prise d'effet."),
    endIso: z.string().refine((value) => isoDayOrNull(value) !== null, "Indiquez l'échéance."),
    renewal: z.enum(["aucune", "tacite"]),
    signedOn: z.string().refine((value) => value === "" || isoDayOrNull(value) !== null, "Indiquez une date de signature valide."),
  })
  .superRefine((values, context) => {
    if (isoDayOrNull(values.startIso) && isoDayOrNull(values.endIso) && values.endIso < values.startIso) {
      context.addIssue({ code: "custom", path: ["endIso"], message: "L'échéance ne peut pas précéder la prise d'effet." });
    }
    addTermIssues(values, context);
    const chosen = values.units.map((unit) => unit.unitId);
    if (chosen.some((unitId) => unitId === "")) context.addIssue({ code: "custom", path: ["units"], message: "Choisissez un lot pour chaque ligne, ou retirez la ligne vide." });
    else if (new Set(chosen).size !== chosen.length) context.addIssue({ code: "custom", path: ["units"], message: "Un même lot ne peut figurer qu'une fois." });
  });

export type MandatApiFormValues = z.infer<typeof mandatApiFormSchema>;

export function toNewApiMandat(values: MandatApiFormValues, draft: boolean): NewMandat {
  const percentage = values.feeKind === "percentage";
  const letting = optionalRate(values.lettingRate);
  const worksFee = optionalRate(values.worksFeeRate);
  return {
    mandantId: values.mandantId,
    lots: [],
    api: {
      typeId: values.typeId,
      unitIds: values.units.map((unit) => unit.unitId),
      currency: values.currency,
      feeKind: values.feeKind,
      ...(percentage ? {} : { flatFeeMinor: toMinor(values.flatFee, values.currency) }),
      feeBase: feeBaseSchema.parse(values.feeBase),
      feeMinimumMinor: toMinor(values.feeMinimum, values.currency),
      feeTaxMode: values.feeTaxMode,
      ...(typeof letting === "number" ? { lettingFeeBasisPoints: letting } : {}),
      ...(typeof worksFee === "number" ? { worksFeeBasisPoints: worksFee } : {}),
      ...(draft || values.signedOn === "" ? {} : { signedOnIso: values.signedOn }),
    },
    feeBasisPoints: percentage ? (parseRateBasisPoints(values.feePercent) ?? 0) : 0,
    payoutDay: Number(values.payoutDay),
    worksLimitMinor: toMinor(values.worksLimit, values.currency),
    renewal: values.renewal,
    startIso: values.startIso,
    endIso: values.endIso,
    signed: !draft && values.signedOn !== "",
  };
}
