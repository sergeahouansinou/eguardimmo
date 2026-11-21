import type { z } from "zod";
import { currencyName, formatAmountInput, formatRateInput, parseAmount, parseRateBasisPoints } from "@/lib/currency";
import type { Currency } from "@/lib/currency";
import type { TermDefaults, TermDefaultsInput } from "./api/apiDefaults";
import { feeBaseSchema } from "./api/apiSchemas";
import type { ApiFeeBase, ApiFeeTaxMode } from "./api/apiSchemas";
import { OPTIONAL_RATE_MESSAGE, optionalRate } from "./feeTerms";
import { amountMessage, toMinor } from "./forms";

const MAX_FEE_BASIS_POINTS = 10_000;

export interface TermsFormValues {
  currency: Currency;
  feeKind: "percentage" | "flat";
  feePercent: string;
  flatFee: string;
  feeBase: ApiFeeBase | "";
  feeMinimum: string;
  feeTaxMode: ApiFeeTaxMode;
  payoutDay: string;
  worksLimit: string;
  lettingRate: string;
  worksFeeRate: string;
}

export const termsFieldOf = (field: string, feeKind: TermsFormValues["feeKind"]): string => (field === "feePercent" && feeKind === "flat" ? "flatFee" : field);

export function addTermIssues(values: TermsFormValues, context: z.RefinementCtx): void {
  if (parseAmount(values.worksLimit, values.currency) === null) context.addIssue({ code: "custom", path: ["worksLimit"], message: amountMessage(values.currency) });
  if (parseAmount(values.feeMinimum, values.currency) === null) context.addIssue({ code: "custom", path: ["feeMinimum"], message: `Saisissez le minimum par mois en ${currencyName(values.currency)}, 0 si aucun.` });
  if (values.feeKind === "percentage") {
    const rate = parseRateBasisPoints(values.feePercent);
    if (rate === null || rate <= 0 || rate > MAX_FEE_BASIS_POINTS) context.addIssue({ code: "custom", path: ["feePercent"], message: "Saisissez un taux entre 0,01 et 100 %, par exemple 7,00." });
  } else {
    const flat = parseAmount(values.flatFee, values.currency);
    if (flat === null || flat <= 0) context.addIssue({ code: "custom", path: ["flatFee"], message: `Saisissez le forfait mensuel en ${currencyName(values.currency)}, par exemple 45.` });
  }
  if (optionalRate(values.lettingRate) === undefined) context.addIssue({ code: "custom", path: ["lettingRate"], message: OPTIONAL_RATE_MESSAGE });
  if (optionalRate(values.worksFeeRate) === undefined) context.addIssue({ code: "custom", path: ["worksFeeRate"], message: OPTIONAL_RATE_MESSAGE });
}

export function defaultsToFormValues(defaults: TermDefaults): TermsFormValues {
  const currency: Currency = defaults.currency;
  return {
    currency,
    feeKind: defaults.feeKind,
    feePercent: defaults.feeBasisPoints === undefined ? "" : formatRateInput(defaults.feeBasisPoints),
    flatFee: defaults.flatFeeMinor === undefined ? "" : formatAmountInput(defaults.flatFeeMinor, currency),
    feeBase: defaults.feeBase,
    feeMinimum: formatAmountInput(defaults.feeMinimumMinor, currency),
    feeTaxMode: defaults.feeTaxMode,
    payoutDay: String(defaults.payoutDay),
    worksLimit: formatAmountInput(defaults.worksLimitMinor, currency),
    lettingRate: defaults.lettingFeeBasisPoints === null ? "" : formatRateInput(defaults.lettingFeeBasisPoints),
    worksFeeRate: defaults.worksFeeBasisPoints === null ? "" : formatRateInput(defaults.worksFeeBasisPoints),
  };
}

export function toTermDefaultsInput(values: TermsFormValues): TermDefaultsInput {
  const percentage = values.feeKind === "percentage";
  return {
    feeKind: values.feeKind,
    ...(percentage ? { feeBasisPoints: parseRateBasisPoints(values.feePercent) ?? 0 } : { flatFeeMinor: toMinor(values.flatFee, values.currency) }),
    feeBase: feeBaseSchema.parse(values.feeBase),
    feeMinimumMinor: toMinor(values.feeMinimum, values.currency),
    feeTaxMode: values.feeTaxMode,
    payoutDay: Number(values.payoutDay),
    worksLimitMinor: toMinor(values.worksLimit, values.currency),
    lettingFeeBasisPoints: optionalRate(values.lettingRate) ?? null,
    worksFeeBasisPoints: optionalRate(values.worksFeeRate) ?? null,
  };
}
