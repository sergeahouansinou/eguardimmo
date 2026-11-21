import type { ApiClient } from "@eguardimmo/api";
import type { z } from "zod";
import { toAddress } from "../shared/mapping";
import type { CursorPage } from "../shared/model";
import { listQuery, parse, segment } from "../shared/parse";
import type { LeaseUnit, OwnerLease, OwnerLeaseDetail } from "./model";
import { leaseDetailSchema, leasePageSchema, leaseResponseSchema, leaseSchema, leaseUnitSchema } from "./schemas";

export const LEASES_PATH = "/api/v1/owner/leases";

function toUnit(unit: z.infer<typeof leaseUnitSchema>): LeaseUnit {
  return {
    id: unit.id,
    reference: unit.reference,
    typeKey: unit.type,
    floor: unit.floor,
    surfaceHundredths: unit.surface_hundredths,
    propertyName: unit.property.name,
    address: toAddress(unit.property.address),
  };
}

function toLease(lease: z.infer<typeof leaseSchema>): OwnerLease {
  return {
    id: lease.id,
    reference: lease.reference,
    status: lease.status,
    phase: lease.phase,
    startsOn: lease.starts_on,
    endDate: lease.end_date,
    agency: lease.agency,
    mandantName: lease.mandant.name,
    mainUnit: lease.main_unit === null ? null : toUnit(lease.main_unit),
    tenants: lease.tenants.map((tenant) => ({ displayName: tenant.display_name, role: tenant.role, validFrom: tenant.valid_from, endDate: tenant.end_date })),
  };
}

function toDetail(lease: z.infer<typeof leaseDetailSchema>): OwnerLeaseDetail {
  return {
    ...toLease(lease),
    durationMonths: lease.duration_months,
    tacitRenewal: lease.tacit_renewal,
    periodicity: lease.periodicity,
    billingTiming: lease.billing_timing,
    dueDay: lease.due_day,
    currency: lease.currency,
    signedOn: lease.signed_on,
    notice: lease.notice === null ? null : { receivedOn: lease.notice.received_on, givenBy: lease.notice.given_by, departureOn: lease.notice.departure_on },
    units: lease.units.map((link) => ({ unit: link.unit === null ? null : toUnit(link.unit), isMain: link.is_main, validFrom: link.valid_from, endDate: link.end_date })),
    termsOn: lease.terms_on,
    terms: lease.terms.map((term) => ({
      componentLabel: term.component?.label ?? null,
      amount: term.amount,
      vatBasisPoints: term.vat_bp,
      indexed: term.indexed,
      validFrom: term.valid_from,
      endDate: term.end_date,
    })),
  };
}

export async function fetchLeasesPage(client: ApiClient, agency: string | null, cursor: string | null): Promise<CursorPage<OwnerLease>> {
  const page = parse(leasePageSchema, await client.get(LEASES_PATH, listQuery(agency, cursor)));
  return { items: page.data.map(toLease), nextCursor: page.meta.next_cursor };
}

export async function fetchLease(client: ApiClient, id: string): Promise<OwnerLeaseDetail> {
  return toDetail(parse(leaseResponseSchema, await client.get(`${LEASES_PATH}/${segment(id)}`)).data);
}
