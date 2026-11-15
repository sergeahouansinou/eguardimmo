import { monthLabel } from "./dates";
import { settlementTotals, sum } from "./derive";
import { feeOf } from "./money";
import type { Fiscal, Report, Settlement, SettlementLine } from "./schemas";

const FEE_RATE = 7;
const MANDATE_SUFFIX = "0142";

export interface RentSpec {
  lotId: string;
  called: number;
  collected: number;
}

export function nextMonthFifth(month: string): string {
  const [year, mon] = month.split("-").map(Number);
  const next = (mon ?? 1) === 12 ? { y: (year ?? 0) + 1, m: 1 } : { y: year ?? 0, m: (mon ?? 1) + 1 };
  return `${String(next.y)}-${String(next.m).padStart(2, "0")}-05`;
}

export function buildSettlement(month: string, rents: readonly RentSpec[], works: number, status: "paid" | "pending"): Settlement {
  const lines: SettlementLine[] = rents.map((rent) => ({
    lotId: rent.lotId,
    called: rent.called,
    collected: rent.collected,
    fees: feeOf(rent.collected, FEE_RATE),
  }));
  return {
    month,
    status,
    reversedOn: nextMonthFifth(month),
    reference: `REV-${month.slice(0, 4)}-${month.slice(5)}-${MANDATE_SUFFIX}`,
    works,
    lines,
  };
}

function monthRow(settlement: Settlement): Report["months"][number] {
  const totals = settlementTotals(settlement);
  return {
    month: settlement.month,
    called: totals.called,
    collected: totals.collected,
    fees: totals.fees,
    works: totals.works,
    reversedOn: settlement.reversedOn,
    reference: settlement.reference,
  };
}

interface ReportSpec {
  id: string;
  label: string;
  longLabel: string;
  span: string;
  startOn: string;
  endOn: string;
  availableOn: string;
  status: Report["status"];
  sizeKo: number;
  observations: string;
  works?: Report["works"];
  arrears?: Report["arrears"];
}

const NO_ARREARS = (span: string): Report["arrears"] => [
  { title: "Aucun impayé sur le trimestre", detail: `Tous les loyers de ${span} ont été encaissés`, tone: "success", badge: "100 %" },
];

export function buildReport(spec: ReportSpec, settlements: readonly Settlement[]): Report {
  const lotTotals = new Map<string, { collected: number; fees: number }>();
  for (const settlement of settlements) {
    for (const line of settlement.lines) {
      const current = lotTotals.get(line.lotId) ?? { collected: 0, fees: 0 };
      lotTotals.set(line.lotId, { collected: current.collected + line.collected, fees: current.fees + line.fees });
    }
  }
  const [first, last] = [settlements[0], settlements.at(-1)];
  const monthsSpan = first && last ? `${monthLabel(first.month).toLowerCase()} à ${monthLabel(last.month).toLowerCase()}` : "";
  return {
    id: spec.id,
    label: spec.label,
    longLabel: spec.longLabel,
    span: spec.span,
    startOn: spec.startOn,
    endOn: spec.endOn,
    availableOn: spec.availableOn,
    status: spec.status,
    months: settlements.map(monthRow),
    lots: Array.from(lotTotals, ([lotId, total]) => ({ lotId, ...total })),
    works: spec.works ?? [],
    arrears: spec.arrears ?? NO_ARREARS(monthsSpan),
    observations: spec.observations,
    pages: 2,
    sizeKo: spec.sizeKo,
  };
}

export function buildFiscal(settlements: readonly Settlement[], lotCount: number): Fiscal {
  const totals = settlements.map(settlementTotals);
  return {
    year: 2026,
    asOf: "2026-11-13",
    regime: "reel",
    microAllowancePercent: 30,
    lines: [
      { id: "loyers", group: "recettes", label: `Loyers encaissés, ${String(lotCount)} lots`, amount: sum(totals.map((t) => t.collected)), origin: "Comptes rendus de gestion" },
      { id: "honoraires", group: "charges", label: "Honoraires de gestion", amount: sum(totals.map((t) => t.fees)), origin: "Factures de l'agence" },
      { id: "forfait", group: "charges", label: "Autres frais de gestion, forfait de 20 € par lot", amount: 2000 * lotCount, origin: "Forfait" },
      { id: "assurance", group: "charges", label: "Primes d'assurance propriétaire", amount: 21000, origin: "Attestation déposée" },
      { id: "reparations", group: "charges", label: "Réparations et entretien", amount: sum(totals.map((t) => t.works)), origin: "Intervention du 18/07/2026" },
      { id: "taxe-fonciere", group: "charges", label: "Taxe foncière 2026", amount: 118000, origin: "Avis déposé le 15/10/2026" },
      { id: "provisions", group: "charges", label: "Provisions pour charges de copropriété", amount: 66000, origin: "Appels de charges" },
      { id: "interets", group: "charges", label: "Intérêts d'emprunt", amount: 480000, origin: "Saisis par vous le 02/11/2026" },
    ],
    proofs: [
      { id: "avis-taxe-fonciere", title: "Avis de taxe foncière 2026", detail: "Déposé le 15/10/2026", tone: "success" },
      { id: "tableau-amortissement", title: "Tableau d'amortissement du prêt", detail: "Saisi le 02/11/2026", tone: "success" },
      { id: "attestation-assurance", title: "Attestation d'assurance", detail: "À renouveler au 31/12/2026", tone: "warning", badge: "À renouveler" },
    ],
  };
}

export type { ReportSpec };
