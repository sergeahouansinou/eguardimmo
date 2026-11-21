import { MANDANT_A, eur } from "../shared/fixtures";

export const PARTY_ID = "0193a5e1-0000-7000-8000-0000000000a9";

const line = (overrides: Record<string, unknown>) => ({
  date: "2026-11-03",
  reference: "JE-2026-0001",
  label: "Loyer novembre 2026",
  source: "payment",
  unit_id: null,
  lease_id: null,
  is_reversal: false,
  debit: eur(0),
  credit: eur(0),
  balance: eur(0),
  ...overrides,
});

export const STATEMENT_RESPONSE = {
  data: {
    mandant: { party_id: PARTY_ID, name: MANDANT_A.name },
    from: "2026-11-01",
    to: "2026-11-30",
    opening_balance: eur(0),
    closing_balance: eur(64120),
    lines: [
      line({ credit: eur(70000), balance: eur(70000) }),
      line({ date: "2026-11-05", reference: "JE-2026-0002", label: "Honoraires de gestion", source: "fee_settlement", debit: eur(5880), balance: eur(64120) }),
      line({ date: "2026-11-06", reference: "JE-2026-0003", label: "Annulation de l'encaissement du 03/11", source: "payment", is_reversal: true, debit: eur(70000), balance: eur(-5880) }),
      line({ date: "2026-11-07", reference: "JE-2026-0004", label: "Encaissement rétabli", source: "payment", credit: eur(70000), balance: eur(64120) }),
    ],
  },
};

export const EMPTY_STATEMENT_RESPONSE = {
  data: { ...STATEMENT_RESPONSE.data, opening_balance: eur(64120), closing_balance: eur(64120), lines: [] },
};
