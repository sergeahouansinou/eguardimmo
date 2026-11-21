import { eur, xof } from "../shared/fixtures";

export const STATEMENT_ID = "0193a5e1-0000-7000-8000-000000000501";
export const SECOND_STATEMENT_ID = "0193a5e1-0000-7000-8000-000000000502";
export const THIRD_STATEMENT_ID = "0193a5e1-0000-7000-8000-000000000503";

export const STATEMENT_DUE = {
  id: STATEMENT_ID,
  number: "DC-2026-0004",
  status: "issued",
  agency_name: "Agence du Lac",
  period: { start: "2025-01-01", end: "2026-01-01" },
  tenant_names: ["Awa Diallo", "Moussa Diallo"],
  unit: { reference: "A1", property_name: "Résidence Les Filaos" },
  share_total: eur(48250),
  provisions_called: eur(36000),
  balance: eur(12250),
  issued_at: "2026-02-10T09:30:00+00:00",
};

export const STATEMENT_REFUND = {
  ...STATEMENT_DUE,
  id: SECOND_STATEMENT_ID,
  number: "DC-2026-0005",
  tenant_names: ["Koffi Mensah"],
  unit: { reference: "B2", property_name: "Résidence Les Filaos" },
  share_total: eur(30000),
  provisions_called: eur(41750),
  balance: eur(-11750),
};

export const STATEMENT_SUPERSEDED = {
  ...STATEMENT_DUE,
  id: THIRD_STATEMENT_ID,
  number: "DC-2026-0003",
  status: "superseded",
  tenant_names: [],
  unit: { reference: null, property_name: null },
  share_total: eur(24000),
  provisions_called: eur(24000),
  balance: eur(0),
  issued_at: null,
};

export const STATEMENT_XOF = {
  ...STATEMENT_DUE,
  share_total: xof(480000),
  provisions_called: xof(600000),
  balance: xof(-120000),
};

export const STATEMENT_DETAIL = {
  ...STATEMENT_DUE,
  lines: [
    { label: "Eau froide", split_label: "Consommation", item_amount: eur(120000), days: 365, share: eur(21000) },
    { label: "Entretien des parties communes", split_label: "Tantièmes 64/1 000", item_amount: eur(300000), days: 365, share: eur(19200) },
    { label: "Taxe d’enlèvement des ordures ménagères", split_label: "Surface 64,2 m²", item_amount: eur(80000), days: 365, share: eur(8050) },
  ],
};

export function statementsPage(data: readonly unknown[], nextCursor: string | null = null) {
  return { data, next_cursor: nextCursor };
}
