import { SECOND_UNIT_ID, UNIT_ID } from "../properties/fixtures";
import { REPORT_ID } from "../reports/fixtures";
import { MANDATE_ID } from "../mandates/fixtures";
import { AGENCY_A, MANDANT_A, eur } from "../shared/fixtures";

export const HOME_RESPONSE = {
  data: {
    agency: AGENCY_A,
    mandant: { name: MANDANT_A.name, role: "holder" },
    access: { in_grace: false, until: null },
    currency: "EUR",
    mandate: {
      id: MANDATE_ID,
      reference: "M-2026-0001",
      status: "active",
      is_suspended: false,
      starts_on: "2026-01-01",
      end_date: "2028-12-31",
      fee_kind: "percentage",
      fee_basis_points: 700,
      fee_flat_amount: null,
      payout_day: 5,
    },
    mandates_count: 1,
    month: {
      period: "2026-11",
      from: "2026-11-01",
      to: "2026-11-30",
      called: eur(120000),
      collected: eur(70000),
      arrears: { amount: eur(50000), count: 1, max_days_late: 11 },
    },
    payouts: {
      pending: { net: eur(64120), fees: eur(5880) },
      last: { amount: eur(60000), date: "2026-10-05", number: "RV-2026-0006" },
      next_date: "2026-12-05",
      next_notice: null,
    },
    last_report: {
      id: REPORT_ID,
      number: "CRG-2026-0010",
      status: "published",
      period: { kind: "monthly", start: "2026-10-01", end: "2026-10-31" },
      published_at: "2026-11-03T09:00:00+00:00",
      first_read_at: null,
      is_read: false,
    },
    counters: { units_total: 3, units_occupied: 2, units_vacant: 1, quotes_to_decide: 2 },
    units: [
      {
        id: UNIT_ID,
        reference: "A1",
        property_name: "Résidence Les Filaos",
        label: "Résidence Les Filaos - A1",
        type: "apartment",
        surface_hundredths: 6500,
        state: "occupied",
        tenant: { name: "Pauline Martin" },
        rent: eur(70000),
        collected: eur(70000),
      },
      {
        id: SECOND_UNIT_ID,
        reference: "B2",
        property_name: "Résidence Les Filaos",
        label: "Résidence Les Filaos - B2",
        type: "studio",
        surface_hundredths: 2850,
        state: "late",
        tenant: { name: "Jean Koffi" },
        rent: eur(50000),
        collected: eur(0),
      },
      {
        id: "0193a5e1-0000-7000-8000-0000000000c3",
        reference: "C3",
        property_name: "Résidence Les Filaos",
        label: "Résidence Les Filaos - C3",
        type: "parking",
        surface_hundredths: null,
        state: "vacant",
        tenant: null,
        rent: null,
        collected: eur(0),
      },
    ],
  },
};

export const HOME_CO_OWNER_RESPONSE = {
  data: { ...HOME_RESPONSE.data, mandant: { name: MANDANT_A.name, role: "co_owner" }, payouts: null },
};

export const HOME_EMPTY_RESPONSE = {
  data: {
    ...HOME_RESPONSE.data,
    mandate: null,
    mandates_count: 0,
    month: { ...HOME_RESPONSE.data.month, called: eur(0), collected: eur(0), arrears: { amount: eur(0), count: 0, max_days_late: 0 } },
    payouts: { pending: null, last: null, next_date: null, next_notice: null },
    last_report: null,
    counters: { units_total: 0, units_occupied: 0, units_vacant: 0, quotes_to_decide: 0 },
    units: [],
  },
};
