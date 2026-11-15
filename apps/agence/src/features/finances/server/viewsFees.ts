import { VAT_BASIS_POINTS } from "@/features/shared/agencyDefaults";
import { DEMO_TODAY, formatDayMonth, formatPeriod } from "@/features/shared/dates";
import { LOTS, MANDANTS, mandantById } from "@/features/shared/directory";
import { DemoServerError } from "@/features/shared/errors";
import { splitVat, sum } from "@/features/shared/money";
import { BASE_LABELS, COLLECTION_LABELS, FEE_PERIODS, executionDateOf, rateText } from "../format";
import { baremeInputSchema } from "../inputs";
import type { BaremeInput } from "../inputs";
import type { Baremes, Honoraires, Simulation } from "../schemas";
import { CURRENT_PERIOD } from "./model";
import type { FinancesState } from "./model";
import { parseInput } from "./parse";
import { feeFor, mandantFigures, schemeAt, unpaidLotIds } from "./rules";

const YEAR = "2026";

function periodLabel(period: string): string {
  return period === YEAR ? `Année ${YEAR}` : formatPeriod(period);
}

interface FeeLine {
  collectedMinor: number;
  feeMinor: number;
}

function linesOf(state: FinancesState, mandantId: string, period: string): FeeLine {
  const live = mandantFigures(state, mandantId, CURRENT_PERIOD);
  if (period === CURRENT_PERIOD) return { collectedMinor: live.collectedMinor, feeMinor: live.feeMinor };
  const records = state.records.filter((record) => record.mandantId === mandantId && (period === YEAR ? record.period.startsWith(YEAR) && record.period !== CURRENT_PERIOD : record.period === period));
  const past = { collectedMinor: sum(records.map((record) => record.collectedMinor)), feeMinor: sum(records.map((record) => record.feeMinor)) };
  return period === YEAR ? { collectedMinor: past.collectedMinor + live.collectedMinor, feeMinor: past.feeMinor + live.feeMinor } : past;
}

function retentionLabel(state: FinancesState, mandantId: string, period: string): string {
  if (period === YEAR) return "Retenus sur l'année";
  const scheme = schemeAt(state, mandantId, DEMO_TODAY);
  if (scheme.collection === "encaissement") return "Retenus à l'encaissement";
  const paidOn = period === CURRENT_PERIOD ? executionDateOf(period) : (state.records.find((record) => record.mandantId === mandantId && record.period === period)?.paidOn ?? executionDateOf(period));
  return `Retenus le ${formatDayMonth(paidOn)}`;
}

function modeOf<T>(values: readonly T[]): T | undefined {
  const counts = new Map<T, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

export function honoraires(state: FinancesState, period: string): Honoraires {
  if (!FEE_PERIODS.some((item) => item.value === period)) throw new DemoServerError("periode_inconnue", "Période inconnue.");
  const rows = MANDANTS.flatMap((mandant) => {
    const line = linesOf(state, mandant.id, period);
    if (line.collectedMinor === 0 && line.feeMinor === 0) return [];
    return [
      {
        mandantId: mandant.id,
        name: mandant.name,
        kind: mandant.kind,
        mateRef: mandant.mandateRef,
        rateBp: schemeAt(state, mandant.id, DEMO_TODAY).rateBp,
        collectedMinor: line.collectedMinor,
        feeMinor: line.feeMinor,
        htMinor: splitVat(line.feeMinor, VAT_BASIS_POINTS).ht,
        vatMinor: splitVat(line.feeMinor, VAT_BASIS_POINTS).vat,
        pendingMinor: period === "2026-10" ? 0 : mandantFigures(state, mandant.id, CURRENT_PERIOD).pendingFeeMinor,
        retention: retentionLabel(state, mandant.id, period),
      },
    ];
  });
  const feeMinor = sum(rows.map((row) => row.feeMinor));
  const { ht, vat } = splitVat(feeMinor, VAT_BASIS_POINTS);
  const current = MANDANTS.map((mandant) => schemeAt(state, mandant.id, DEMO_TODAY));
  const commonRate = modeOf(current.map((scheme) => scheme.rateBp));
  const representative = current.find((scheme) => scheme.rateBp === commonRate) ?? current[0];
  return {
    period,
    label: periodLabel(period),
    periods: FEE_PERIODS.map(({ value, label }) => ({ value, label })),
    rows,
    collectedMinor: sum(rows.map((row) => row.collectedMinor)),
    feeMinor,
    htMinor: ht,
    vatMinor: vat,
    pendingMinor: sum(rows.map((row) => row.pendingMinor)),
    unpaidCount: period === "2026-10" ? 0 : unpaidLotIds(state).length,
    lotsCount: LOTS.length,
    mandantsCount: rows.length,
    scheme: {
      rateLabel: `${commonRate === undefined ? "Selon mandat" : `${rateText(commonRate)} TTC`} des loyers`,
      baseLabel: representative ? BASE_LABELS[representative.base] : "",
      collectionLabel: representative ? COLLECTION_LABELS[representative.collection] : "",
      sameRateCount: current.filter((scheme) => scheme.rateBp === commonRate).length,
      totalMandants: MANDANTS.length,
      upcoming: state.schemes
        .filter((scheme) => scheme.effectiveFrom > DEMO_TODAY)
        .map((scheme) => ({ mandantName: mandantById(scheme.mandantId)?.name ?? scheme.mandantId, rateBp: scheme.rateBp, effectiveFrom: scheme.effectiveFrom })),
    },
  };
}

export function baremes(state: FinancesState): Baremes {
  return MANDANTS.map((mandant) => {
    const scheme = schemeAt(state, mandant.id, DEMO_TODAY);
    const lines = mandantFigures(state, mandant.id, CURRENT_PERIOD).lines;
    return {
      mandantId: mandant.id,
      name: mandant.name,
      label: `${mandant.mandateRef}, ${mandant.name}`,
      lots: lines.length,
      monthlyMinor: sum(lines.map((line) => line.calledMinor)),
      current: {
        rateBp: scheme.rateBp,
        base: scheme.base,
        minFeeMinor: scheme.minFeeMinor,
        collection: scheme.collection,
        relocationPercent: scheme.relocationPercent,
        worksBp: scheme.worksBp,
      },
    };
  });
}

export function simulateBareme(state: FinancesState, input: BaremeInput): Simulation {
  const parsed = parseInput(baremeInputSchema, input);
  const current = schemeAt(state, parsed.mandantId, DEMO_TODAY);
  const { lines } = mandantFigures(state, parsed.mandantId, CURRENT_PERIOD);
  const payments = lines.flatMap((line) => line.payments.map((payment) => ({ payment, installment: line.installment })));
  const currentFee = sum(payments.map(({ payment, installment }) => feeFor(payment.amountMinor, installment, current)));
  const newFee = sum(payments.map(({ payment, installment }) => feeFor(payment.amountMinor, installment, parsed)));
  return {
    collectedMinor: sum(payments.map(({ payment }) => payment.amountMinor)),
    currentRateBp: current.rateBp,
    currentFeeMinor: currentFee,
    newFeeMinor: newFee,
    differenceMinor: newFee - currentFee,
  };
}
