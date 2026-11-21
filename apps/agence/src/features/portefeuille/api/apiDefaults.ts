import { z } from "zod";
import type { Currency } from "@/lib/currency";
import { unexpectedResponse } from "./apiErrors";
import { supportedCurrency } from "./apiMapping";
import { feeBaseSchema, feeKindSchema, feeTaxModeSchema } from "./apiSchemas";
import type { ApiFeeBase, ApiFeeKind, ApiFeeTaxMode } from "./apiSchemas";

const money = z.object({ amount: z.number().int().nonnegative(), currency: z.string().length(3) });
const basisPoints = z.number().int().min(0).max(10_000);

export const apiTermDefaultsSchema = z.object({
  fee_kind: feeKindSchema,
  fee_basis_points: basisPoints.nullable(),
  fee_flat_amount: money.nullable(),
  fee_base: feeBaseSchema,
  fee_minimum_amount: money,
  fee_tax_mode: feeTaxModeSchema,
  payout_day: z.number().int().min(1).max(28),
  works_limit_amount: money,
  letting_fee_basis_points: basisPoints.nullable(),
  works_fee_basis_points: basisPoints.nullable(),
  currency: z.string().length(3),
  lock_version: z.number().int().positive(),
  updated_at: z.iso.datetime({ offset: true }),
});
export type ApiTermDefaults = z.infer<typeof apiTermDefaultsSchema>;
export const apiTermDefaultsResponseSchema = z.object({ data: apiTermDefaultsSchema });

export const TERM_DEFAULTS_NOT_FOUND_CODE = "mandate_term_defaults_not_found";

export interface TermDefaults {
  feeKind: ApiFeeKind;
  feeBasisPoints?: number;
  flatFeeMinor?: number;
  feeBase: ApiFeeBase;
  feeMinimumMinor: number;
  feeTaxMode: ApiFeeTaxMode;
  payoutDay: number;
  worksLimitMinor: number;
  lettingFeeBasisPoints: number | null;
  worksFeeBasisPoints: number | null;
  currency: Currency;
  lockVersion: number;
  updatedAt: string;
}

export interface TermDefaultsInput {
  feeKind: ApiFeeKind;
  feeBasisPoints?: number;
  flatFeeMinor?: number;
  feeBase: ApiFeeBase;
  feeMinimumMinor: number;
  feeTaxMode: ApiFeeTaxMode;
  payoutDay: number;
  worksLimitMinor: number;
  lettingFeeBasisPoints: number | null;
  worksFeeBasisPoints: number | null;
}

export function toTermDefaults(api: ApiTermDefaults): TermDefaults {
  const currency = supportedCurrency(api.currency);
  const amounts = [api.fee_minimum_amount, api.works_limit_amount, ...(api.fee_flat_amount === null ? [] : [api.fee_flat_amount])];
  if (amounts.some((amount) => amount.currency !== currency)) throw unexpectedResponse("devises des conditions par défaut incohérentes");
  return {
    feeKind: api.fee_kind,
    ...(api.fee_basis_points === null ? {} : { feeBasisPoints: api.fee_basis_points }),
    ...(api.fee_flat_amount === null ? {} : { flatFeeMinor: api.fee_flat_amount.amount }),
    feeBase: api.fee_base,
    feeMinimumMinor: api.fee_minimum_amount.amount,
    feeTaxMode: api.fee_tax_mode,
    payoutDay: api.payout_day,
    worksLimitMinor: api.works_limit_amount.amount,
    lettingFeeBasisPoints: api.letting_fee_basis_points,
    worksFeeBasisPoints: api.works_fee_basis_points,
    currency,
    lockVersion: api.lock_version,
    updatedAt: api.updated_at,
  };
}

export function termDefaultsPayload(lockVersion: number | null, input: TermDefaultsInput): Record<string, unknown> {
  const percentage = input.feeKind === "percentage";
  return {
    ...(lockVersion === null ? {} : { lock_version: lockVersion }),
    fee_kind: input.feeKind,
    ...(percentage ? { fee_basis_points: input.feeBasisPoints } : { fee_flat_amount: input.flatFeeMinor }),
    fee_base: input.feeBase,
    fee_minimum_amount: input.feeMinimumMinor,
    fee_tax_mode: input.feeTaxMode,
    payout_day: input.payoutDay,
    works_limit_amount: input.worksLimitMinor,
    letting_fee_basis_points: input.lettingFeeBasisPoints,
    works_fee_basis_points: input.worksFeeBasisPoints,
  };
}
