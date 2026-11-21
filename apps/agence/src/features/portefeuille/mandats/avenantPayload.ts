import { formatAmountInput, formatRateInput, parseRateBasisPoints } from "@/lib/currency";
import type { Currency } from "@/lib/currency";
import { feeBaseSchema, feeTaxModeSchema } from "../api/apiSchemas";
import { optionalRate } from "../feeTerms";
import { toMinor } from "../forms";
import { currencyOfMandat } from "../labels";
import type { AvenantFormValues } from "../forms";
import type { Mandat } from "../schemas";
import type { NewAvenant } from "../source";

export interface AvenantPayloadOptions {
  api: boolean;
  currency: Currency;
  current?: Pick<Mandat, "lettingFeeBasisPoints" | "worksFeeBasisPoints">;
}

const rateChange = (text: string, current: number | undefined): number | null | undefined => {
  const next = optionalRate(text);
  if (next === undefined) return undefined;
  return next === (current ?? null) ? undefined : next;
};

export function toNewAvenant(values: AvenantFormValues, options: AvenantPayloadOptions = { api: false, currency: "EUR" }): NewAvenant {
  const feeBase = options.api ? feeBaseSchema.safeParse(values.feeBase).data : undefined;
  const feeTaxMode = options.api ? feeTaxModeSchema.safeParse(values.feeTaxMode).data : undefined;
  const letting = options.api ? rateChange(values.lettingRate, options.current?.lettingFeeBasisPoints) : undefined;
  const worksFee = options.api ? rateChange(values.worksFeeRate, options.current?.worksFeeBasisPoints) : undefined;
  return {
    mandatId: values.mandatId,
    kind: values.kind,
    effectIso: values.effectIso,
    note: values.note,
    ...(values.kind === "honoraires"
      ? {
          feeBasisPoints: parseRateBasisPoints(values.feePercent) ?? 0,
          ...(feeBase === undefined ? {} : { feeBase }),
          ...(feeTaxMode === undefined ? {} : { feeTaxMode }),
          ...(options.api ? { feeMinimumMinor: toMinor(values.feeMinimum, options.currency) } : {}),
          ...(letting === undefined ? {} : { lettingFeeBasisPoints: letting }),
          ...(worksFee === undefined ? {} : { worksFeeBasisPoints: worksFee }),
        }
      : {}),
    ...(values.kind === "duree" ? { endIso: values.endIso } : {}),
    ...(values.kind === "reversement" ? { payoutDay: Number(values.payoutDay) } : {}),
    ...(values.kind === "travaux" ? { worksLimitMinor: toMinor(values.worksLimit, options.currency) } : {}),
  };
}

export function termDefaults(mandat: Mandat | undefined) {
  const currency = currencyOfMandat(mandat);
  const known = mandat !== undefined && mandat.termsMissing !== true;
  return {
    feePercent: known ? formatRateInput(mandat.feeBasisPoints) : "",
    worksLimit: known ? formatAmountInput(mandat.worksLimitMinor, currency) : "",
    feeBase: mandat?.feeBase ?? "",
    feeMinimum: formatAmountInput(mandat?.feeMinimumMinor ?? 0, currency),
    feeTaxMode: mandat?.feeTaxMode ?? "excl_tax",
    lettingRate: mandat?.lettingFeeBasisPoints === undefined ? "" : formatRateInput(mandat.lettingFeeBasisPoints),
    worksFeeRate: mandat?.worksFeeBasisPoints === undefined ? "" : formatRateInput(mandat.worksFeeBasisPoints),
  };
}
