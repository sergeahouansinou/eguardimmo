import { MandatesApiError } from "./apiErrors";
import type { MandatesApiErrorKind } from "./apiErrors";
import { PortefeuilleError } from "../source";
import type { PortefeuilleErrorKind } from "../source";

const FIELD_BY_SERVER_FIELD: Readonly<Record<string, string>> = {
  mandant_party_id: "mandantId",
  mandate_type_term_id: "typeId",
  starts_on: "startIso",
  end_date: "endIso",
  "terms.fee_kind": "feePercent",
  "terms.fee_basis_points": "feePercent",
  "terms.fee_flat_amount": "feePercent",
  "terms.payout_day": "payoutDay",
  "terms.works_limit_amount": "worksLimit",
  fee_basis_points: "feePercent",
  fee_flat_amount: "feePercent",
  fee_kind: "feePercent",
  payout_day: "payoutDay",
  works_limit_amount: "worksLimit",
  fee_base: "feeBase",
  fee_minimum_amount: "feeMinimum",
  fee_tax_mode: "feeTaxMode",
  "terms.fee_base": "feeBase",
  "terms.fee_minimum_amount": "feeMinimum",
  "terms.fee_tax_mode": "feeTaxMode",
  letting_fee_basis_points: "lettingRate",
  works_fee_basis_points: "worksFeeRate",
  "terms.letting_fee_basis_points": "lettingRate",
  "terms.works_fee_basis_points": "worksFeeRate",
  signed_file_id: "signedFile",
  stored_file_id: "file",
  file: "file",
  kind: "kind",
  effective_on: "effectIso",
  notice_given_on: "effectIso",
  signed_on: "signedOn",
  months: "endIso",
};

const FIELD_BY_CODE: Readonly<Record<string, string>> = {
  mandate_overlap: "lots",
  mandate_no_unit: "lots",
  mandate_unit_not_available: "lots",
  mandate_unit_conflict: "lots",
  mandate_party_not_available: "mandantId",
  mandate_fee_invalid: "feePercent",
  mandate_termination_invalid: "effectIso",
  mandate_signature_invalid: "signedOn",
  mandate_renewal_invalid: "endIso",
};

export type OperationContext = "create" | "amend" | "terminate" | "renew" | "document" | "defaults" | "other";

const PERIOD_FIELD: Readonly<Record<OperationContext, string | undefined>> = {
  create: "endIso",
  amend: "effectIso",
  terminate: "effectIso",
  renew: "endIso",
  document: undefined,
  defaults: undefined,
  other: undefined,
};

const FILE_CODES: readonly string[] = ["mandate_amendment_signature_required", "mandate_document_invalid", "document_not_clean", "mandate_document_not_found"];

const KIND_BY_API_KIND: Readonly<Partial<Record<MandatesApiErrorKind, PortefeuilleErrorKind>>> = {
  stale_version: "stale_version",
  forbidden: "forbidden",
  agency_only: "forbidden",
  overlap: "overlap",
  not_clean: "not_clean",
  conflict: "conflict",
  invalid: "invalid",
  unsupported: "unavailable",
};

function fieldOf(error: MandatesApiError, context: OperationContext): string | undefined {
  for (const serverField of Object.keys(error.fieldErrors)) {
    const exact = FIELD_BY_SERVER_FIELD[serverField];
    if (exact !== undefined) return exact;
    if (serverField.startsWith("units")) return "lots";
  }
  if (FILE_CODES.includes(error.code)) return context === "amend" ? "signedFile" : context === "document" ? "file" : undefined;
  if (error.code === "mandate_period_invalid" || error.code === "mandate_term_conflict") return PERIOD_FIELD[context];
  return FIELD_BY_CODE[error.code];
}

export async function guarded<T>(context: OperationContext, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof MandatesApiError) {
      throw new PortefeuilleError(error.message, fieldOf(error, context), KIND_BY_API_KIND[error.kind] ?? "unknown");
    }
    throw error;
  }
}

export const unavailableAction = (what: string): PortefeuilleError =>
  new PortefeuilleError(`${what} : cette fonction n’est pas encore reliée au serveur.`, undefined, "unavailable");
