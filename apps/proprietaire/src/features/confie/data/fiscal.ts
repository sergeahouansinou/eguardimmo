import { sum } from "./derive";
import type { Fiscal, FiscalLine } from "./schemas";

export function fiscalSummary(fiscal: Fiscal) {
  const revenue = sum(fiscal.lines.filter((line) => line.group === "recettes").map((line) => line.amount));
  const charges = fiscal.lines.filter((line) => line.group === "charges");
  const totalCharges = sum(charges.map((line) => line.amount));
  const interest = fiscal.lines.find((line) => line.id === "interets")?.amount ?? 0;
  const result = revenue - totalCharges;
  const microTaxable = Math.round((revenue * (100 - fiscal.microAllowancePercent)) / 100);
  return { revenue, totalCharges, interest, result, microTaxable, realIsBetter: result <= microTaxable };
}

interface FormLine {
  line: string;
  label: string;
  lineId: string;
  detail?: string;
}

const REVENUE_LINES: readonly FormLine[] = [{ line: "211", label: "Loyers bruts encaissés", lineId: "loyers" }];

const CHARGE_LINES: readonly FormLine[] = [
  { line: "221", label: "Frais d'administration et de gestion", lineId: "honoraires", detail: "Honoraires de l'agence" },
  { line: "222", label: "Autres frais de gestion", lineId: "forfait", detail: "Forfait de 20 € par lot" },
  { line: "223", label: "Primes d'assurance", lineId: "assurance", detail: "Attestation déposée" },
  { line: "224", label: "Réparation, entretien et amélioration", lineId: "reparations" },
  { line: "227", label: "Taxes foncières", lineId: "taxe-fonciere", detail: "Avis de taxe foncière 2026" },
  { line: "229", label: "Provisions pour charges payées", lineId: "provisions", detail: "Copropriété" },
];

export interface DeclarationLine {
  line: string;
  label: string;
  detail: string;
  amount: number;
  total?: boolean;
}

export interface Declaration {
  revenue: DeclarationLine[];
  charges: DeclarationLine[];
  interest: DeclarationLine[];
  totals: { revenue: number; charges: number; interest: number; result: number };
}

export function declaration2044(fiscal: Fiscal): Declaration {
  const byId = new Map<string, FiscalLine>(fiscal.lines.map((line) => [line.id, line]));
  const pick = (spec: FormLine): DeclarationLine => {
    const source = byId.get(spec.lineId);
    return { line: spec.line, label: spec.label, detail: spec.detail ?? source?.origin ?? "", amount: source?.amount ?? 0 };
  };
  const revenue = REVENUE_LINES.map(pick);
  const charges = CHARGE_LINES.map(pick);
  const interestSource = byId.get("interets");
  const totals = {
    revenue: sum(revenue.map((line) => line.amount)),
    charges: sum(charges.map((line) => line.amount)),
    interest: interestSource?.amount ?? 0,
    result: 0,
  };
  totals.result = totals.revenue - totals.charges - totals.interest;
  return {
    revenue: [...revenue, { line: "215", label: "Total des recettes", detail: "Lignes 211 à 214", amount: totals.revenue, total: true }],
    charges: [...charges, { line: "240", label: "Total des frais et charges", detail: "Lignes 221 à 230", amount: totals.charges, total: true }],
    interest: [{ line: "250", label: "Intérêts d'emprunt", detail: interestSource?.origin ?? "", amount: totals.interest }],
    totals,
  };
}
