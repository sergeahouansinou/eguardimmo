import { AGENCY_A, MANDANT_A, eur } from "../shared/fixtures";
import { UNIT_ID } from "../properties/fixtures";

export const MANDATE_ID = "0193a5e1-0000-7000-8000-0000000000d1";
export const END_REQUEST_ID = "0193a5e1-0000-7000-8000-0000000000d2";

export const END_REQUEST = {
  id: END_REQUEST_ID,
  mandate_id: MANDATE_ID,
  status: "pending",
  reason: "Je souhaite vendre le bien.",
  requested_at: "2026-11-19T09:00:00+00:00",
  cancelled_at: null,
};

export const MANDATE = {
  id: MANDATE_ID,
  reference: "MAN-2025-014",
  status: "active",
  type: { key: "management", label: "Gestion locative" },
  agency: AGENCY_A,
  mandant: MANDANT_A,
  starts_on: "2025-01-01",
  end_date: "2027-12-31",
  tacit_renewal: true,
  renewal_months: 12,
  notice_months: 3,
  currency: "EUR",
  signed_on: "2024-12-15",
  notice_given_on: null,
  end_request: null,
  terms: {
    fee_kind: "percentage",
    fee_basis_points: 700,
    fee_flat_amount: null,
    fee_base: "rent_and_charges",
    fee_minimum_amount: eur(1500),
    fee_tax_mode: "incl_tax",
    payout_day: 10,
    valid_from: "2025-01-01",
  },
  units: [{ id: UNIT_ID, reference: "A1", property_name: "Résidence Les Filaos", valid_from: "2025-01-01", end_date: null }],
};

export const MANDATE_WITH_REQUEST = { ...MANDATE, end_request: END_REQUEST };
