import type { ApiClient } from "@eguardimmo/api";
import { listQuery, parse, segment } from "../shared/parse";
import type { PayoutsPage, RentMonth } from "./model";
import { payoutPageSchema, rentSchema } from "./schemas";

export const RENT_PATH = "/api/v1/owner/rent";
export const PAYOUTS_PATH = "/api/v1/owner/payouts";

export async function fetchRentMonth(client: ApiClient, month: string, agency: string | null): Promise<RentMonth> {
  const { data } = parse(rentSchema, await client.get(`${RENT_PATH}/${segment(month)}`, listQuery(agency, null)));
  return {
    month: data.month,
    mandants: data.mandants.map((entry) => ({
      agency: entry.agency,
      mandantName: entry.mandant.name,
      role: entry.mandant.role,
      currency: entry.currency,
      units: entry.units.map((row) => ({
        id: row.unit.id,
        reference: row.unit.reference,
        propertyName: row.unit.property_name,
        amounts: row.amounts,
        arrears: row.arrears,
      })),
      others: entry.others,
      totals: entry.totals,
    })),
  };
}

export async function fetchPayoutsPage(client: ApiClient, agency: string | null, cursor: string | null): Promise<PayoutsPage> {
  const page = parse(payoutPageSchema, await client.get(PAYOUTS_PATH, listQuery(agency, cursor)));
  return {
    items: page.data.map((entry) => ({
      id: entry.id,
      number: entry.number,
      status: entry.status,
      date: entry.date,
      amount: entry.amount,
      bankLast4: entry.bank_last4,
      agency: entry.agency,
      mandantName: entry.mandant.name,
    })),
    nextCursor: page.meta.next_cursor,
    upcoming: page.upcoming.map((entry) => ({ agency: entry.agency, mandantName: entry.mandant.name, date: entry.date, notice: entry.notice })),
  };
}
