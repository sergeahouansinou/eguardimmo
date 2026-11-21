import { AGENCY_A, eur } from "../shared/fixtures";

export const INTERVENTION_ID = "0193a5e1-0000-7000-8000-000000000301";
export const SECOND_INTERVENTION_ID = "0193a5e1-0000-7000-8000-000000000302";
export const APPROVAL_ID = "0193a5e1-0000-7000-8000-000000000361";
export const QUOTE_FINGERPRINT = "a3f1c0de5b7e49d2a3f1c0de5b7e49d2a3f1c0de5b7e49d2a3f1c0de5b7e49d2";
export const FILE_ID = "0193a5e1-0000-7000-8000-000000000311";
const QUOTE_ID = "0193a5e1-0000-7000-8000-000000000321";
const INVOICE_ID = "0193a5e1-0000-7000-8000-000000000331";

export const INTERVENTION = {
  id: INTERVENTION_ID,
  reference: "INT-2026-0031",
  status: "awaiting_approval",
  priority: "normal",
  nature: { key: "plumbing", label: "Plomberie" },
  title: "Fuite sous l’évier",
  agency: AGENCY_A,
  mandate_id: "0193a5e1-0000-7000-8000-000000000211",
  place: { property_name: "Résidence Les Filaos", unit_reference: "A1", common_area: false },
  supplier: { name: "Plomberie Koffi" },
  responsibility: "owner",
  approval_basis: "owner_approved",
  estimated_amount: eur(12000),
  reported_on: "2026-11-10",
  due_on: "2026-11-30",
  completed_on: null,
  closed_at: null,
};

export const SECOND_INTERVENTION = {
  ...INTERVENTION,
  id: SECOND_INTERVENTION_ID,
  reference: "INT-2026-0028",
  status: "closed",
  priority: "urgent",
  title: "Fuite d’eau",
  place: { property_name: "Résidence Les Filaos", unit_reference: null, common_area: true },
  supplier: null,
  estimated_amount: null,
  due_on: null,
};

export const INTERVENTION_DETAIL = {
  ...INTERVENTION,
  description: "Fuite constatée par l’agence lors de la visite.",
  emergency_reason: null,
  visits: [{ id: "0193a5e1-0000-7000-8000-000000000341", scheduled_on: "2026-11-14", slot: "morning", status: "confirmed" }],
  events: [
    { id: "0193a5e1-0000-7000-8000-000000000351", kind: "reported", author: "tenant", text: null, created_at: "2026-11-10T08:30:00+00:00" },
    { id: "0193a5e1-0000-7000-8000-000000000352", kind: "comment", author: "team", text: "Le plombier passera jeudi matin.", created_at: "2026-11-11T10:05:00+00:00" },
  ],
  files: [{ id: FILE_ID, kind: "photo_before", name: "Photo de la fuite.jpg", created_at: "2026-11-10T08:40:00+00:00" }],
  quotes: [
    {
      id: QUOTE_ID,
      reference: "DV-2026-0007",
      kind: "initial",
      status: "submitted",
      issued_on: "2026-11-12",
      valid_until: "2026-12-12",
      proposed_on: "2026-11-14",
      total_net: eur(10000),
      total_tax: eur(2000),
      total_gross: eur(12000),
      lines: [{ position: 1, label: "Remplacement du siphon", quantity_milli: 1000, unit: "u", unit_price: eur(10000), net_amount: eur(10000), tax_rate_pcm: 20000 }],
    },
  ],
  approvals: [
    {
      id: APPROVAL_ID,
      lock_version: 3,
      quote_fingerprint: QUOTE_FINGERPRINT,
      statement_version: "v1",
      quote_id: QUOTE_ID,
      status: "pending",
      amount: eur(12000),
      ceiling_amount: eur(10000),
      requested_at: "2026-11-12T09:00:00+00:00",
      decide_before: "2026-11-26T09:00:00+00:00",
      decided_at: null,
      decided_via: null,
      comment: null,
    },
  ],
  invoices: [{ id: INVOICE_ID, number: "FP-884", status: "allocated", invoice_on: "2026-11-15", due_on: "2026-12-15", total_net: eur(10000), total_tax: eur(2000), total_gross: eur(12000) }],
  allocations: [{ id: "0193a5e1-0000-7000-8000-000000000371", invoice_id: INVOICE_ID, charged_amount: eur(12000), created_at: "2026-11-16T12:00:00+00:00" }],
};
