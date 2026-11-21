import type { ApiClient } from "@eguardimmo/api";
import { parse } from "../shared/parse";
import type { OwnerHome } from "./model";
import { homeSchema } from "./schemas";

export const HOME_PATH = "/api/v1/owner/home";

export async function fetchHome(client: ApiClient, agency: string): Promise<OwnerHome> {
  const { data } = parse(homeSchema, await client.get(HOME_PATH, { agency }));
  return {
    agency: data.agency,
    mandantName: data.mandant.name,
    role: data.mandant.role,
    currency: data.currency,
    mandate:
      data.mandate === null
        ? null
        : {
            id: data.mandate.id,
            reference: data.mandate.reference,
            status: data.mandate.status,
            isSuspended: data.mandate.is_suspended,
            startsOn: data.mandate.starts_on,
            endDate: data.mandate.end_date,
            feeKind: data.mandate.fee_kind,
            feeBasisPoints: data.mandate.fee_basis_points,
            feeFlatAmount: data.mandate.fee_flat_amount,
            payoutDay: data.mandate.payout_day,
          },
    mandatesCount: data.mandates_count,
    month: {
      period: data.month.period,
      from: data.month.from,
      to: data.month.to,
      called: data.month.called,
      collected: data.month.collected,
      arrears: { amount: data.month.arrears.amount, count: data.month.arrears.count, maxDaysLate: data.month.arrears.max_days_late },
    },
    payouts: data.payouts === null ? null : { pending: data.payouts.pending, last: data.payouts.last, nextDate: data.payouts.next_date, nextNotice: data.payouts.next_notice },
    lastReport:
      data.last_report === null
        ? null
        : { id: data.last_report.id, number: data.last_report.number, status: data.last_report.status, period: data.last_report.period, publishedAt: data.last_report.published_at, isRead: data.last_report.is_read },
    counters: {
      unitsTotal: data.counters.units_total,
      unitsOccupied: data.counters.units_occupied,
      unitsVacant: data.counters.units_vacant,
      quotesToDecide: data.counters.quotes_to_decide,
    },
    units: data.units.map((unit) => ({
      id: unit.id,
      reference: unit.reference,
      propertyName: unit.property_name,
      label: unit.label,
      type: unit.type,
      surfaceHundredths: unit.surface_hundredths,
      state: unit.state,
      tenantName: unit.tenant?.name ?? null,
      rent: unit.rent,
      collected: unit.collected,
    })),
  };
}
