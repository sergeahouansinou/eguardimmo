import { ADDRESS, AGENCY_A, MANDANT_A, eur } from "../shared/fixtures";
import { UNIT_ID } from "../properties/fixtures";

export const LEASE_ID = "0193a5e1-0000-7000-8000-0000000000d1";
export const SECOND_LEASE_ID = "0193a5e1-0000-7000-8000-0000000000d2";

export const LEASE_UNIT = {
  id: UNIT_ID,
  reference: "A1",
  type: "apartment",
  floor: 2,
  surface_hundredths: 6450,
  property: { name: "Résidence Les Filaos", address: ADDRESS },
};

export const LEASE = {
  id: LEASE_ID,
  reference: "BL-2026-0042",
  status: "signed",
  phase: "running",
  starts_on: "2025-03-01",
  end_date: null,
  agency: AGENCY_A,
  mandant: MANDANT_A,
  main_unit: LEASE_UNIT,
  tenants: [{ display_name: "Awa Diallo", role: "tenant", valid_from: "2025-03-01", end_date: null }],
};

export const SECOND_LEASE = {
  ...LEASE,
  id: SECOND_LEASE_ID,
  reference: null,
  phase: "ended",
  status: "terminated",
  end_date: "2026-02-28",
  main_unit: null,
  tenants: [{ display_name: "Locataire anonymisé", role: "tenant", valid_from: "2024-01-01", end_date: "2026-02-28" }],
};

export const LEASE_DETAIL = {
  ...LEASE,
  regime_key: "residential",
  duration_months: 36,
  tacit_renewal: true,
  periodicity: "monthly",
  billing_timing: "advance",
  due_day: 5,
  currency: "EUR",
  signed_on: "2025-02-20",
  notice: { received_on: "2026-09-01", given_by: "tenant", departure_on: "2026-12-01" },
  units: [{ unit: LEASE_UNIT, is_main: true, valid_from: "2025-03-01", end_date: null }],
  terms_on: "2026-11-19",
  terms: [
    { component: { key: "rent", label: "Loyer", semantic_key: "rent" }, amount: eur(65000), vat_bp: 0, indexed: true, valid_from: "2025-03-01", end_date: null },
    { component: { key: "charges", label: "Provision pour charges", semantic_key: "charges" }, amount: eur(5000), vat_bp: 1000, indexed: false, valid_from: "2025-03-01", end_date: null },
  ],
};
