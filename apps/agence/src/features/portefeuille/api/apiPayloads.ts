import type { ApiFeeBase, ApiFeeKind, ApiFeeTaxMode } from "./apiSchemas";

export interface MandateTermsInput {
  feeKind: ApiFeeKind;
  feeBasisPoints?: number;
  feeFlatAmountMinor?: number;
  payoutDay: number;
  worksLimitMinor: number;
  feeBase?: ApiFeeBase;
  feeMinimumMinor?: number;
  feeTaxMode?: ApiFeeTaxMode;
  lettingFeeBasisPoints?: number;
  worksFeeBasisPoints?: number;
}

export interface MandateUnitInput {
  unitId: string;
  validFrom?: string;
}

export interface NewMandateInput {
  mandantPartyId: string;
  mandateTypeTermId: string;
  startsOn: string;
  endDate: string;
  tacitRenewal: boolean;
  renewalMonths?: number;
  noticeMonths?: number;
  currency: string;
  terms: MandateTermsInput;
  units: readonly MandateUnitInput[];
  note?: string;
}

export interface MandateChanges {
  mandantPartyId?: string;
  mandateTypeTermId?: string;
  startsOn?: string;
  endDate?: string;
  tacitRenewal?: boolean;
  renewalMonths?: number;
  noticeMonths?: number;
  currency?: string;
  note?: string | null;
  terms?: MandateTermsInput;
  units?: readonly MandateUnitInput[];
}

export interface TerminationInput {
  noticeGivenOn: string;
  effectiveOn: string;
  reason: string;
  amicable: boolean;
  note?: string;
}

export interface TermsAmendmentInput {
  effectiveOn: string;
  feeKind?: ApiFeeKind;
  feeBasisPoints?: number;
  feeFlatAmountMinor?: number;
  payoutDay?: number;
  worksLimitMinor?: number;
  feeBase?: ApiFeeBase;
  feeMinimumMinor?: number;
  feeTaxMode?: ApiFeeTaxMode;
  lettingFeeBasisPoints?: number | null;
  worksFeeBasisPoints?: number | null;
  signedFileId?: string;
}

const omitUndefined = (body: Record<string, unknown>): Record<string, unknown> => Object.fromEntries(Object.entries(body).filter(([, value]) => value !== undefined));

export function termsPayload(terms: MandateTermsInput): Record<string, unknown> {
  return omitUndefined({
    fee_kind: terms.feeKind,
    fee_basis_points: terms.feeKind === "percentage" ? terms.feeBasisPoints : undefined,
    fee_flat_amount: terms.feeKind === "flat" ? terms.feeFlatAmountMinor : undefined,
    payout_day: terms.payoutDay,
    works_limit_amount: terms.worksLimitMinor,
    fee_base: terms.feeBase,
    fee_minimum_amount: terms.feeMinimumMinor,
    fee_tax_mode: terms.feeTaxMode,
    letting_fee_basis_points: terms.lettingFeeBasisPoints,
    works_fee_basis_points: terms.worksFeeBasisPoints,
  });
}

const unitsPayload = (units: readonly MandateUnitInput[]): Record<string, unknown>[] =>
  units.map((unit) => omitUndefined({ unit_id: unit.unitId, valid_from: unit.validFrom }));

export const createPayload = (input: NewMandateInput): Record<string, unknown> =>
  omitUndefined({
    mandant_party_id: input.mandantPartyId,
    mandate_type_term_id: input.mandateTypeTermId,
    starts_on: input.startsOn,
    end_date: input.endDate,
    tacit_renewal: input.tacitRenewal,
    renewal_months: input.renewalMonths,
    notice_months: input.noticeMonths,
    currency: input.currency,
    note: input.note,
    terms: termsPayload(input.terms),
    units: unitsPayload(input.units),
  });

export const updatePayload = (lockVersion: number, changes: MandateChanges): Record<string, unknown> =>
  omitUndefined({
    lock_version: lockVersion,
    mandant_party_id: changes.mandantPartyId,
    mandate_type_term_id: changes.mandateTypeTermId,
    starts_on: changes.startsOn,
    end_date: changes.endDate,
    tacit_renewal: changes.tacitRenewal,
    renewal_months: changes.renewalMonths,
    notice_months: changes.noticeMonths,
    currency: changes.currency,
    note: changes.note,
    terms: changes.terms === undefined ? undefined : termsPayload(changes.terms),
    units: changes.units === undefined ? undefined : unitsPayload(changes.units),
  });

export const versionPayload = (lockVersion: number): Record<string, unknown> => ({ lock_version: lockVersion });

export const activatePayload = (lockVersion: number, signedOn: string, signedFileId?: string): Record<string, unknown> =>
  omitUndefined({ lock_version: lockVersion, signed_on: signedOn, signed_file_id: signedFileId });

export const terminatePayload = (lockVersion: number, input: TerminationInput): Record<string, unknown> =>
  omitUndefined({
    lock_version: lockVersion,
    notice_given_on: input.noticeGivenOn,
    effective_on: input.effectiveOn,
    reason: input.reason,
    amicable: input.amicable,
    note: input.note === "" ? undefined : input.note,
  });

export const renewPayload = (lockVersion: number, months: number): Record<string, unknown> => ({ lock_version: lockVersion, months });

export const amendPayload = (lockVersion: number, input: TermsAmendmentInput): Record<string, unknown> =>
  omitUndefined({
    lock_version: lockVersion,
    effective_on: input.effectiveOn,
    fee_kind: input.feeKind,
    fee_basis_points: input.feeBasisPoints,
    fee_flat_amount: input.feeFlatAmountMinor,
    payout_day: input.payoutDay,
    works_limit_amount: input.worksLimitMinor,
    fee_base: input.feeBase,
    fee_minimum_amount: input.feeMinimumMinor,
    fee_tax_mode: input.feeTaxMode,
    letting_fee_basis_points: input.lettingFeeBasisPoints,
    works_fee_basis_points: input.worksFeeBasisPoints,
    signed_file_id: input.signedFileId,
  });

export const addUnitPayload = (lockVersion: number, unit: MandateUnitInput): Record<string, unknown> =>
  omitUndefined({ lock_version: lockVersion, unit_id: unit.unitId, valid_from: unit.validFrom });

export const endUnitPayload = (lockVersion: number, endDate: string): Record<string, unknown> => ({ lock_version: lockVersion, end_date: endDate });
