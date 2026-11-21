import { AGENCY_A, AGENCY_B, eur } from "../shared/fixtures";

export const STATEMENT_ID = "0193a5e1-0000-7000-8000-0000000000e1";
export const OLD_STATEMENT_ID = "0193a5e1-0000-7000-8000-0000000000e2";
export const OTHER_STATEMENT_ID = "0193a5e1-0000-7000-8000-0000000000e3";

const line = (code: string, label: string, rounded: number, status = "computed") => ({
  code,
  label,
  status,
  exact: eur(rounded * 100 + 37),
  rounded: eur(rounded * 100),
  sources: [{ kind: "rent_collected", ref: null, amount: eur(rounded * 100) }],
  sources_truncated: false,
});

export const INCOME = {
  income_year: 2025,
  form_version: "fr-2044-2025",
  currency: "EUR",
  provisional: false,
  household_complete: false,
  properties: [
    {
      property_id: null,
      name: "Résidence des Filaos",
      premises: 2,
      co_owners: [],
      lines: [line("211", "Loyers bruts encaissés", 12_000), line("221", "Frais d’administration et de gestion", 900, "proposed")],
    },
  ],
  totals: [line("215", "Total des recettes", 12_000, "total"), line("263", "Revenu foncier net", 4_100, "total")],
  micro: { gross_receipts: eur(1_200_000), allowance_bp: 3000, base_after_allowance: eur(840_000), threshold: eur(1_500_000), real_base: eur(410_000) },
  deficit: null,
  warnings: [{ code: "shared_ownership", property_id: null, message: "Ce bien est détenu à plusieurs : vérifiez les quotes-parts avant de déclarer." }],
  warning: "Estimation indicative : elle ne remplace ni le formulaire officiel ni un conseil professionnel.",
  mentions: ["Montants arrondis à l’euro le plus proche."],
};

const base = {
  id: STATEMENT_ID,
  agency: AGENCY_A,
  income_year: 2025,
  form_version: "fr-2044-2025",
  status: "published",
  currency: "EUR",
  supersedes_id: null,
  has_pdf: true,
  published_at: "2026-03-12T09:00:00+00:00",
};

export const STATEMENT = { ...base, totals: [{ code: "215", amount: eur(1_200_000) }, { code: "263", amount: eur(410_000) }] };
export const SUPERSEDED_STATEMENT = { ...STATEMENT, id: OLD_STATEMENT_ID, status: "superseded", income_year: 2025, published_at: "2026-02-20T09:00:00+00:00" };
export const OTHER_AGENCY_STATEMENT = { ...STATEMENT, id: OTHER_STATEMENT_ID, agency: AGENCY_B };
export const STATEMENT_DETAIL = { ...base, supersedes_id: OLD_STATEMENT_ID, income: INCOME };
