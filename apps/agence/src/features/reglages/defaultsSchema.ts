import { z } from "zod";
import { CURRENCIES } from "@/lib/currency";
import { feeBaseSchema, feeTaxModeSchema } from "@/features/portefeuille/api/apiSchemas";
import { addTermIssues, termsFieldOf } from "@/features/portefeuille/termsForm";
import type { TermsFormValues } from "@/features/portefeuille/termsForm";

export const defaultsFormSchema = z
  .object({
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
  })
  .superRefine((values, context) => {
    addTermIssues(values, context);
  });

export type DefaultsFormValues = z.infer<typeof defaultsFormSchema> & TermsFormValues;

export const BLANK_DEFAULTS_FORM: DefaultsFormValues = {
  currency: "EUR",
  feeKind: "percentage",
  feePercent: "",
  flatFee: "",
  feeBase: "",
  feeMinimum: "0",
  feeTaxMode: "excl_tax",
  payoutDay: "5",
  worksLimit: "0",
  lettingRate: "",
  worksFeeRate: "",
};

export const DEFAULTS_FORM_FIELDS: readonly (keyof DefaultsFormValues)[] = [
  "currency",
  "feeKind",
  "feePercent",
  "flatFee",
  "feeBase",
  "feeMinimum",
  "feeTaxMode",
  "payoutDay",
  "worksLimit",
  "lettingRate",
  "worksFeeRate",
];

export function defaultsFieldOf(field: string | undefined, feeKind: DefaultsFormValues["feeKind"]): keyof DefaultsFormValues | undefined {
  if (field === undefined) return undefined;
  const target = termsFieldOf(field, feeKind);
  return DEFAULTS_FORM_FIELDS.find((name) => name === target);
}
