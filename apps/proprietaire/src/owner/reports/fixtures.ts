import { AGENCY_A, MANDANT_A, eur } from "../shared/fixtures";
import { UNIT_ID } from "../properties/fixtures";

export const REPORT_ID = "0193a5e1-0000-7000-8000-0000000000f1";
export const OLD_REPORT_ID = "0193a5e1-0000-7000-8000-0000000000f2";

export const REPORT = {
  id: REPORT_ID,
  number: "CRG-2026-0012",
  status: "published",
  agency: AGENCY_A,
  mandant: MANDANT_A,
  period: { kind: "monthly", start: "2026-10-01", end: "2026-10-31" },
  currency: "EUR",
  sections: ["rent", "fees", "payout"],
  totals: {
    opening_balance: eur(10000),
    collected: eur(70000),
    fees: eur(5600),
    works: null,
    payout: eur(64400),
    adjustments: eur(0),
    closing_balance: eur(10000),
  },
  template_version: 1,
  supersedes_id: null,
  published_at: "2026-11-02T08:15:00+00:00",
  first_read_at: null,
};

export const SUPERSEDED_REPORT = { ...REPORT, id: OLD_REPORT_ID, number: "CRG-2026-0009", status: "superseded", period: { kind: "quarterly", start: "2026-07-01", end: "2026-09-30" } };

export const REPORT_DETAIL = {
  ...REPORT,
  supersedes_id: OLD_REPORT_ID,
  options: { reminder_detail: false },
  mandates: [],
  units: [
    { id: UNIT_ID, reference: "A1", property_name: "Résidence Les Filaos", address: { line1: "12 rue des Filaos" }, mandate_id: null, lease_id: null, lease_reference: "BL-2026-0042", tenants: ["Awa Diallo"] },
  ],
  receipts: [{ number: "QT-2026-0101", issued_on: "2026-10-08" }],
  lines: [
    { position: 1, kind: "rent_collected", date: "2026-10-05", unit_id: UNIT_ID, lease_id: null, mandate_id: null, label: "Loyer octobre", amount: eur(70000), direction: "credit", intervention_reference: null },
    { position: 2, kind: "fee", date: "2026-10-31", unit_id: UNIT_ID, lease_id: null, mandate_id: null, label: "Honoraires de gestion", amount: eur(5600), direction: "debit", intervention_reference: null },
    { position: 3, kind: "works", date: "2026-10-20", unit_id: UNIT_ID, lease_id: null, mandate_id: null, label: "Remplacement du robinet", amount: eur(12000), direction: "debit", intervention_reference: "INT-2026-0031" },
  ],
};
