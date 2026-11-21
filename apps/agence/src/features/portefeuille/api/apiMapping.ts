import { currencyOf } from "@/lib/currency";
import type { Currency } from "@/lib/currency";
import { daysBetween } from "@/lib/dates";
import { unexpectedResponse, unsupported } from "./apiErrors";
import type { ApiEndRequest, ApiMandant, ApiMandateDetail, ApiMandateSummary, ApiMandateTerms, ApiMandateUnit } from "./apiSchemas";
import { mandatSchema, mandantSchema } from "../schemas";
import type { Mandant, Mandat, MandatStatus, MandatTerms, MandatUnit } from "../schemas";
import type { MandatEndRequest } from "../source";

export const RENEWAL_WINDOW_DAYS = 90;

type ApiMandate = ApiMandateSummary | ApiMandateDetail;

const isDetail = (mandate: ApiMandate): mandate is ApiMandateDetail => "terms_history" in mandate;

export function supportedCurrency(code: string): Currency {
  const currency = currencyOf(code);
  if (currency === undefined) throw unsupported(`La devise ${code} n’est pas prise en charge par ces écrans : seuls les mandats en euros (EUR) et en francs CFA (XOF) le sont.`);
  return currency;
}

export function toMandatStatus(mandate: ApiMandate, todayIso: string): MandatStatus {
  switch (mandate.status) {
    case "draft":
      return "brouillon";
    case "suspended":
      return "suspendu";
    case "expired":
      return "termine";
    case "terminated":
      return mandate.end_date < todayIso ? "termine" : "actif";
    case "active": {
      if (mandate.end_date < todayIso) return "termine";
      const soon = daysBetween(todayIso, mandate.end_date) <= RENEWAL_WINDOW_DAYS;
      return soon && !mandate.tacit_renewal ? "a_renouveler" : "actif";
    }
  }
}

function toUnit(line: ApiMandateUnit): MandatUnit {
  return {
    id: line.id,
    unitId: line.unit?.id ?? null,
    reference: line.unit?.reference ?? "Lot introuvable",
    propertyName: line.unit?.property.name ?? "",
    fromIso: line.valid_from,
    endIso: line.end_date,
  };
}

export function toTerms(terms: ApiMandateTerms, currency: Currency): MandatTerms {
  const sameCurrency = [terms.works_limit_amount, terms.fee_minimum_amount, ...(terms.fee_flat_amount ? [terms.fee_flat_amount] : [])].every((money) => money.currency === currency);
  if (!sameCurrency) throw unexpectedResponse("devises des conditions incohérentes avec celle du mandat");
  return {
    id: terms.id,
    feeKind: terms.fee_kind,
    ...(terms.fee_basis_points === null ? {} : { feeBasisPoints: terms.fee_basis_points }),
    ...(terms.fee_flat_amount === null ? {} : { flatFeeMinor: terms.fee_flat_amount.amount }),
    payoutDay: terms.payout_day,
    worksLimitMinor: terms.works_limit_amount.amount,
    ...(terms.fee_base === null ? {} : { feeBase: terms.fee_base }),
    feeMinimumMinor: terms.fee_minimum_amount.amount,
    feeTaxMode: terms.fee_tax_mode,
    ...(terms.letting_fee_basis_points === null ? {} : { lettingFeeBasisPoints: terms.letting_fee_basis_points }),
    ...(terms.works_fee_basis_points === null ? {} : { worksFeeBasisPoints: terms.works_fee_basis_points }),
    ...(terms.signed_file_id === null ? {} : { signedFileId: terms.signed_file_id }),
    fromIso: terms.valid_from,
    toIso: terms.valid_to,
    reason: terms.reason,
  };
}

export function toMandat(mandate: ApiMandate, todayIso: string): Mandat {
  const currency = supportedCurrency(mandate.currency);
  const terms = mandate.terms === null ? undefined : toTerms(mandate.terms, currency);
  const status = toMandatStatus(mandate, todayIso);
  const pendingEnd = mandate.status === "terminated" && mandate.end_date >= todayIso;
  const detail = isDetail(mandate) ? mandate : null;
  const termination = pendingEnd
    ? {
        effectIso: mandate.end_date,
        note: detail?.termination?.note ?? "",
        ...(detail?.termination ? { reason: detail.termination.reason } : {}),
        ...(detail?.termination?.notice_given_on ? { noticeIso: detail.termination.notice_given_on } : {}),
      }
    : undefined;
  return mandatSchema.parse({
    id: mandate.id,
    number: mandate.reference,
    mandantId: mandate.mandant.id,
    status,
    startIso: mandate.starts_on,
    endIso: mandate.end_date,
    feeBasisPoints: terms?.feeBasisPoints ?? 0,
    ...(terms?.flatFeeMinor === undefined ? {} : { flatFeeMinor: terms.flatFeeMinor }),
    payoutDay: terms?.payoutDay ?? 1,
    worksLimitMinor: terms?.worksLimitMinor ?? 0,
    ...(terms === undefined ? { termsMissing: true } : {}),
    ...(terms?.feeBase === undefined ? {} : { feeBase: terms.feeBase }),
    ...(terms?.feeMinimumMinor === undefined ? {} : { feeMinimumMinor: terms.feeMinimumMinor }),
    ...(terms?.feeTaxMode === undefined ? {} : { feeTaxMode: terms.feeTaxMode }),
    ...(terms?.lettingFeeBasisPoints === undefined ? {} : { lettingFeeBasisPoints: terms.lettingFeeBasisPoints }),
    ...(terms?.worksFeeBasisPoints === undefined ? {} : { worksFeeBasisPoints: terms.worksFeeBasisPoints }),
    renewal: mandate.tacit_renewal ? "tacite" : "aucune",
    signed: mandate.status !== "draft",
    currency: mandate.currency,
    typeLabel: mandate.mandate_type.label,
    archived: mandate.archived_at !== null,
    hasEndRequest: mandate.has_end_request,
    units: mandate.units.map(toUnit),
    ...(termination ? { termination } : {}),
    ...(detail
      ? {
          renewalMonths: detail.renewal_months,
          noticeMonths: detail.notice_months,
          note: detail.note,
          ...(detail.signed_on === null ? {} : { signedOnIso: detail.signed_on }),
          termsHistory: detail.terms_history.map((item) => toTerms(item, currency)),
        }
      : {}),
  });
}

export function toEndRequest(request: ApiEndRequest): MandatEndRequest {
  return {
    status: request.status,
    requestedAt: request.requested_at,
    reason: request.reason,
    cancelledAt: request.cancelled_at,
    decidedAt: request.decided_at,
    decisionNote: request.decision_note,
  };
}

export function toMandant(row: ApiMandant, kind: "person" | "company" | undefined): Mandant {
  return mandantSchema.parse({
    id: row.party_id,
    name: row.display_name,
    legal: kind === undefined ? "Type non précisé" : kind === "person" ? "Particulier" : "Personne morale",
    type: kind === "company" ? "societe" : "particulier",
  });
}
