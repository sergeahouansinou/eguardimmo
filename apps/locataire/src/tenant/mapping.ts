import type { z } from 'zod';
import type { LeaseDetail, LeaseSummary, TenantLink, UnitView } from './model';
import type { ApiLeaseDetail, ApiLeaseSummary, linksSchema } from './schemas';

type ApiUnit = NonNullable<ApiLeaseSummary['main_unit']>;

export function addressOf(address: ApiUnit['property']['address']): string {
  const street = [address.line1, address.line2].filter((part): part is string => typeof part === 'string' && part.trim() !== '').join(', ');
  return `${street}, ${address.postal_code} ${address.city}`;
}

export function toUnit(unit: ApiUnit): UnitView {
  return {
    reference: unit.reference,
    type: unit.type,
    floor: unit.floor,
    surfaceHundredths: unit.surface_hundredths,
    propertyName: unit.property.name,
    address: addressOf(unit.property.address),
  };
}

export function toLeaseSummary(lease: ApiLeaseSummary): LeaseSummary {
  return {
    id: lease.id,
    reference: lease.reference,
    regimeKey: lease.regime_key,
    phase: lease.phase,
    startsOn: lease.starts_on,
    endsOn: lease.end_date,
    organization: { id: lease.organization.id, name: lease.organization.name },
    mainUnit: lease.main_unit === null ? null : toUnit(lease.main_unit),
    accessUntil: lease.access.until,
    inGrace: lease.access.in_grace,
  };
}

export function toLeaseDetail(lease: ApiLeaseDetail): LeaseDetail {
  return {
    ...toLeaseSummary(lease),
    durationMonths: lease.duration_months,
    tacitRenewal: lease.tacit_renewal,
    periodicity: lease.periodicity,
    billingTiming: lease.billing_timing,
    dueDay: lease.due_day,
    currency: lease.currency,
    paymentMethod: lease.payment_method,
    signedOn: lease.signed_on,
    notice:
      lease.notice === null
        ? null
        : { receivedOn: lease.notice.received_on, givenBy: lease.notice.given_by, departureOn: lease.notice.departure_on },
    units: lease.units.map((line) => ({
      unit: line.unit === null ? null : toUnit(line.unit),
      isMain: line.is_main,
      from: line.valid_from,
      to: line.end_date,
    })),
    parties: lease.parties.map((party) => ({
      name: party.display_name,
      role: party.role,
      isMe: party.is_me,
      jointLiability: party.joint_liability,
      from: party.valid_from,
      to: party.end_date,
    })),
    termsOn: lease.terms_on,
    terms: lease.terms.map((term) => ({
      key: term.component?.key ?? null,
      label: term.component?.label ?? null,
      semanticKey: term.component?.semantic_key ?? null,
      amount: term.amount,
      vatBasisPoints: term.vat_bp,
      indexed: term.indexed,
    })),
  };
}

export function toLinks(response: z.infer<typeof linksSchema>): TenantLink[] {
  return response.data.map((link) => ({ partyId: link.id, organization: { id: link.organization.id, name: link.organization.name } }));
}
