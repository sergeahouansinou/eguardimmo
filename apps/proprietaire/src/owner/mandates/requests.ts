import type { ApiClient } from "@eguardimmo/api";
import type { z } from "zod";
import type { CursorPage } from "../shared/model";
import { listQuery, parse, segment } from "../shared/parse";
import type { MandateEndRequest, OwnerMandate } from "./model";
import { endRequestResponseSchema, endRequestSchema, mandatePageSchema, mandateResponseSchema, mandateSchema } from "./schemas";

export const MANDATES_PATH = "/api/v1/owner/mandates";

const endRequestPath = (mandateId: string): string => `${MANDATES_PATH}/${segment(mandateId)}/end-request`;

function toEndRequest(value: z.infer<typeof endRequestSchema>): MandateEndRequest {
  return {
    id: value.id,
    mandateId: value.mandate_id,
    status: value.status,
    reason: value.reason,
    requestedAt: value.requested_at,
    cancelledAt: value.cancelled_at,
  };
}

function toMandate(mandate: z.infer<typeof mandateSchema>): OwnerMandate {
  return {
    id: mandate.id,
    reference: mandate.reference,
    status: mandate.status,
    typeLabel: mandate.type.label,
    agency: mandate.agency,
    mandantName: mandate.mandant.name,
    startsOn: mandate.starts_on,
    endDate: mandate.end_date,
    tacitRenewal: mandate.tacit_renewal,
    renewalMonths: mandate.renewal_months,
    noticeMonths: mandate.notice_months,
    currency: mandate.currency,
    signedOn: mandate.signed_on,
    noticeGivenOn: mandate.notice_given_on,
    endRequest: mandate.end_request === null ? null : toEndRequest(mandate.end_request),
    terms:
      mandate.terms === null
        ? null
        : {
            feeKind: mandate.terms.fee_kind,
            feeBasisPoints: mandate.terms.fee_basis_points,
            feeFlatAmount: mandate.terms.fee_flat_amount,
            feeBase: mandate.terms.fee_base,
            feeMinimumAmount: mandate.terms.fee_minimum_amount,
            feeTaxMode: mandate.terms.fee_tax_mode,
            payoutDay: mandate.terms.payout_day,
            validFrom: mandate.terms.valid_from,
          },
    units: mandate.units.map((unit) => ({ id: unit.id, reference: unit.reference, propertyName: unit.property_name, validFrom: unit.valid_from, endDate: unit.end_date })),
  };
}

export async function fetchMandatesPage(client: ApiClient, agency: string | null, cursor: string | null): Promise<CursorPage<OwnerMandate>> {
  const page = parse(mandatePageSchema, await client.get(MANDATES_PATH, listQuery(agency, cursor)));
  return { items: page.data.map(toMandate), nextCursor: page.meta.next_cursor };
}

export async function fetchMandate(client: ApiClient, id: string): Promise<OwnerMandate> {
  return toMandate(parse(mandateResponseSchema, await client.get(`${MANDATES_PATH}/${segment(id)}`)).data);
}

export async function requestMandateEnd(client: ApiClient, mandateId: string, reason: string | null): Promise<MandateEndRequest> {
  const body = reason === null ? {} : { reason };
  return toEndRequest(parse(endRequestResponseSchema, await client.post(endRequestPath(mandateId), body)).data);
}

export async function cancelMandateEnd(client: ApiClient, mandateId: string): Promise<MandateEndRequest> {
  return toEndRequest(parse(endRequestResponseSchema, await client.delete(endRequestPath(mandateId))).data);
}
