import { AGENCY_A, eur } from "../shared/fixtures";

export const INVOICE_ID = "0193a5e1-0000-7000-8000-000000000201";
export const CREDIT_NOTE_ID = "0193a5e1-0000-7000-8000-000000000202";

export const INVOICE = {
  id: INVOICE_ID,
  kind: "invoice",
  status: "issued",
  number: "FA-2026-0031",
  agency: AGENCY_A,
  mandate_id: "0193a5e1-0000-7000-8000-000000000211",
  credited_invoice_id: null,
  issued_on: "2026-11-02",
  due_on: "2026-11-30",
  service_from: "2026-10-01",
  service_to: "2026-10-31",
  currency: "EUR",
  total_net: eur(5600),
  total_tax: eur(1120),
  total_gross: eur(6720),
  has_pdf: true,
};

export const CREDIT_NOTE = { ...INVOICE, id: CREDIT_NOTE_ID, kind: "credit_note", status: "paid", number: "AV-2026-0002", credited_invoice_id: INVOICE_ID, has_pdf: false };

export const INVOICE_DETAIL = {
  ...INVOICE,
  lines: [{ position: 1, description: "Honoraires de gestion d’octobre 2026", quantity_milli: 1000, unit_price: eur(5600), net_amount: eur(5600), tax_category: "S", tax_rate_pcm: 20000 }],
  taxes: [{ category: "S", rate_pcm: 20000, base_amount: eur(5600), tax_amount: eur(1120) }],
};
