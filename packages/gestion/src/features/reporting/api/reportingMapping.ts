import type {
  AgencyAlerts,
  AgencyKpis,
  AgencyPayouts,
  Aging,
  CreateOutcome,
  LandlordHome,
  Report,
  ReportLine,
  Statement,
} from '../model';
import type { ApiAgencyKpis, ApiAging, ApiAlerts, ApiCreateResult, ApiLandlord, ApiLine, ApiPayouts, ApiReport, ApiStatement } from './reportingSchemas';

export const toAgencyKpis = (api: ApiAgencyKpis): AgencyKpis => ({
  month: api.month,
  currency: api.currency,
  rentCalled: api.rent_called,
  rentCollected: api.rent_collected,
  collectionRateBp: api.collection_rate_basis_points,
  feesNet: api.fees_net,
  periodClosed: api.period_closed,
});

export const toLandlordHome = (api: ApiLandlord): LandlordHome => ({
  month: api.month,
  currency: api.currency,
  rentCalled: api.rent_called,
  rentCollected: api.rent_collected,
  collectionRateBp: api.collection_rate_basis_points,
  leasesEnding: api.leases_ending,
  vacantUnits: api.vacant_units,
  openInterventions: api.open_interventions,
  certificatesToRenew: api.certificates_to_renew,
});

export const toPayouts = (api: ApiPayouts): AgencyPayouts => ({
  payableTotal: api.payable_total,
  inTransitTotal: api.in_transit_total,
  mandantsWithPayable: api.mandants_with_payable,
  topMandants: api.top_mandants.map((mandant) => ({ partyId: mandant.party_id, name: mandant.name, payable: mandant.payable })),
  activeHolds: api.active_holds,
  pendingItems: api.pending_items,
});

export const toAlerts = (api: ApiAlerts): AgencyAlerts => ({
  mandatesToRenew: { count: api.mandates_to_renew.count, next: api.mandates_to_renew.next.map((mandate) => ({ id: mandate.id, reference: mandate.reference, endsOn: mandate.ends_on })) },
  certificatesToRenew: api.certificates_to_renew,
  reportsDue: { period: api.reports_due.period, count: api.reports_due.count, mandantIds: api.reports_due.mandant_ids },
});

export const toAging = (api: ApiAging): Aging => ({ asOf: api.as_of, buckets: api.buckets, total: api.total, count: api.count });

const toLine = (api: ApiLine): ReportLine => ({
  position: api.position,
  kind: api.kind,
  date: api.date,
  unitId: api.unit_id,
  leaseId: api.lease_id,
  mandateId: api.mandate_id,
  label: api.label,
  amount: api.amount,
  direction: api.direction,
});

export const toReport = (api: ApiReport): Report => ({
  id: api.id,
  number: api.number,
  status: api.status,
  mandantId: api.mandant.party_id,
  mandantName: api.mandant.name,
  period: api.period,
  currency: api.currency,
  sections: api.sections,
  options: {
    letterhead: api.options.letterhead ?? true,
    reminderDetail: api.options.reminder_detail ?? false,
    receiptsAttached: api.options.receipts_attached ?? false,
  },
  totals: {
    openingBalance: api.totals.opening_balance,
    collected: api.totals.collected,
    fees: api.totals.fees,
    works: api.totals.works,
    payout: api.totals.payout,
    adjustments: api.totals.adjustments,
    closingBalance: api.totals.closing_balance,
  },
  templateVersion: api.template_version,
  supersedesId: api.supersedes_id,
  rectificationReason: api.rectification_reason,
  scheduledFor: api.scheduled_for,
  notify: api.notify,
  generatedAt: api.generated_at,
  publishedAt: api.published_at,
  firstReadAt: api.first_read_at,
  lockVersion: api.lock_version,
  lines: api.lines === undefined ? null : api.lines.map(toLine),
  units: (api.units ?? []).map((unit) => ({ id: unit.id, reference: unit.reference, propertyName: unit.property_name, tenants: unit.tenants })),
  mandates: (api.mandates ?? []).map((mandate) => ({ id: mandate.id, reference: mandate.reference, feeKind: mandate.fee_kind ?? null, feeBasisPoints: mandate.fee_basis_points ?? null })),
});

export const toOutcome = (api: ApiCreateResult): CreateOutcome => ({
  mandantId: api.mandant_id,
  outcome: api.outcome,
  report: api.report === null ? null : toReport(api.report),
  error: api.error,
});

export const toStatement = (api: ApiStatement): Statement => ({
  mandantId: api.mandant.party_id,
  mandantName: api.mandant.name,
  from: api.from,
  to: api.to,
  openingBalance: api.opening_balance,
  closingBalance: api.closing_balance,
  lines: api.lines.map((line) => ({
    date: line.date,
    reference: line.reference,
    label: line.label,
    source: line.source,
    isReversal: line.is_reversal,
    debit: line.debit,
    credit: line.credit,
    balance: line.balance,
  })),
});
