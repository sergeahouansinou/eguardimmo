import { applyRate } from "@/features/shared/money";
import type { MandantStatement, StatementLine } from "@/features/shared/statement";
import { MANDANTS } from "@/features/shared/directory";
import { createDemoSource } from "../source";
import type { AgenceSource } from "../source";
import type { FinancesSource } from "../finances/source";
import { createComptesRendusDemo } from "./demo";

interface LineSpec {
  lotId: string;
  lotLabel: string;
  description: string;
  tenant: string;
  called: number;
  paidOn: string | null;
  unpaidSince?: string;
  reminders?: number;
}

const SPECS: Record<string, LineSpec[]> = {
  "marc-chevalier": [
    { lotId: "apt-12", lotLabel: "Apt 12", description: "T2, 38 m²", tenant: "Thomas Girard", called: 70000, paidOn: "2026-11-05" },
    { lotId: "studio-4", lotLabel: "Studio 4", description: "Studio, 21 m²", tenant: "Anaïs Roux", called: 45000, paidOn: null, unpaidSince: "2026-11-01", reminders: 2 },
  ],
  "famille-bernard": [
    { lotId: "apt-9", lotLabel: "Apt 9", description: "T3, 61 m²", tenant: "Karim Haddad", called: 137000, paidOn: "2026-11-05" },
    { lotId: "apt-3", lotLabel: "Apt 3", description: "T4, 82 m²", tenant: "Julie Marchand", called: 148000, paidOn: "2026-11-05" },
    { lotId: "apt-7", lotLabel: "Apt 7", description: "T2, 44 m²", tenant: "Louis Petit", called: 51000, paidOn: null, unpaidSince: "2026-10-19", reminders: 2 },
  ],
  "helene-roussel": [
    { lotId: "apt-5", lotLabel: "Apt 5", description: "T3, 55 m²", tenant: "Inès Laurent", called: 74000, paidOn: "2026-11-05" },
    { lotId: "maison-les-pins", lotLabel: "Maison Les Pins", description: "Maison, 96 m²", tenant: "Éric Fabre", called: 110000, paidOn: "2026-11-05" },
  ],
  "sci-les-acacias": [
    { lotId: "lot-1", lotLabel: "Lot 1", description: "T3, 58 m²", tenant: "Camille Dupuis", called: 125000, paidOn: "2026-11-05" },
    { lotId: "lot-2", lotLabel: "Lot 2", description: "T4, 79 m²", tenant: "Yann Morel", called: 148000, paidOn: "2026-11-05" },
    { lotId: "lot-3", lotLabel: "Lot 3", description: "Studio, 25 m²", tenant: "Sarah Mensah", called: 30000, paidOn: null, unpaidSince: "2026-11-05", reminders: 1 },
    { lotId: "lot-4", lotLabel: "Lot 4", description: "T4, 85 m²", tenant: "Olivier Blanc", called: 122000, paidOn: "2026-11-05" },
  ],
  "paul-lemoine": [
    { lotId: "apt-2", lotLabel: "Apt 2", description: "T3, 57 m²", tenant: "Hugo Perrin", called: 76000, paidOn: "2026-11-05" },
    { lotId: "apt-6", lotLabel: "Apt 6", description: "T2, 41 m²", tenant: "Léa Vidal", called: 66000, paidOn: "2026-11-05" },
  ],
  "nadia-benali": [{ lotId: "maison-de-ville", lotLabel: "Maison de ville", description: "Maison, 88 m²", tenant: "Mathieu Garnier", called: 118000, paidOn: "2026-11-05" }],
};

function toLine(spec: LineSpec): StatementLine {
  const collected = spec.paidOn ? spec.called : 0;
  const fee = applyRate(collected, 700);
  return {
    lotId: spec.lotId,
    lotLabel: spec.lotLabel,
    lotDescription: spec.description,
    tenantName: spec.tenant,
    paidOn: spec.paidOn,
    calledMinor: spec.called,
    collectedMinor: collected,
    feeMinor: fee,
    netMinor: collected - fee,
    unpaidSince: spec.unpaidSince ?? null,
    reminders: spec.reminders ?? 0,
  };
}

export function novemberStatements(): MandantStatement[] {
  return MANDANTS.map((mandant) => {
    const lines = (SPECS[mandant.id] ?? []).map(toLine);
    const total = (pick: (line: StatementLine) => number) => lines.reduce((sum, line) => sum + pick(line), 0);
    return {
      mandantId: mandant.id,
      mandantName: mandant.name,
      mandantKind: mandant.kind,
      mandateRef: mandant.mandateRef,
      ibanLast4: mandant.ibanLast4,
      period: "2026-11",
      feeRateBasisPoints: 700,
      lines,
      calledMinor: total((line) => line.calledMinor),
      collectedMinor: total((line) => line.collectedMinor),
      feeMinor: total((line) => line.feeMinor),
      netMinor: total((line) => line.netMinor),
      worksDeductedMinor: 0,
      receipts: lines.filter((line) => line.collectedMinor > 0).length,
      transferDate: "2026-12-05",
    };
  });
}

export function withStatements(finances: FinancesSource, statements: FinancesSource["statements"]): FinancesSource {
  return { ...finances, statements };
}

export function fakeSource(statements: FinancesSource["statements"] = (period) => Promise.resolve(period === "2026-11" ? novemberStatements() : [])): AgenceSource {
  const base = createDemoSource();
  const finances = withStatements(base.finances, statements);
  return { ...base, finances, comptesRendus: createComptesRendusDemo({ finances }) };
}
