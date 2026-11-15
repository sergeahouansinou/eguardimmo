import { VAT_BASIS_POINTS } from "@/features/shared/agencyDefaults";
import { DEMO_TODAY, formatPeriod } from "@/features/shared/dates";
import { AGENCY, LOTS, MANDANTS, lotById, mandantById, tenantById } from "@/features/shared/directory";
import { splitVat, sum } from "@/features/shared/money";
import { executionDateOf } from "../format";
import type { HistoryRow, Reversements, ReversementDetail, ReversementRow, TransferLot } from "../schemas";
import { rateSummary } from "./viewsPayments";
import { CURRENT_PERIOD } from "./model";
import type { FinancesState, ReversementRecord, TransferBatch } from "./model";
import { mandantFigures } from "./rules";

export function currentRecord(state: FinancesState, mandantId: string): ReversementRecord | undefined {
  return state.records.find((record) => record.mandantId === mandantId && record.period === CURRENT_PERIOD);
}

export function currentBatch(state: FinancesState): TransferBatch | undefined {
  return state.batches.find((batch) => batch.period === CURRENT_PERIOD);
}

export function reversementRow(state: FinancesState, mandantId: string): ReversementRow | undefined {
  const mandant = mandantById(mandantId);
  if (!mandant) return undefined;
  const block = state.blocks.find((item) => item.mandantId === mandantId);
  const record = currentRecord(state, mandantId);
  const figures = mandantFigures(state, mandantId, CURRENT_PERIOD);
  return {
    mandantId,
    name: mandant.name,
    kind: mandant.kind,
    mandateRenewal: mandant.mandateRenewal,
    lots: LOTS.filter((lot) => lot.mandantId === mandantId).length,
    collectedMinor: record?.collectedMinor ?? figures.collectedMinor,
    feeMinor: record?.feeMinor ?? figures.feeMinor,
    netMinor: record?.netMinor ?? figures.netMinor,
    ibanLast4: mandant.ibanLast4,
    scheduledOn: record?.paidOn ?? executionDateOf(CURRENT_PERIOD),
    status: record ? "reverse" : block ? "bloque" : "a_reverser",
    blockedReason: block?.reason ?? null,
  };
}

function historyRow(record: ReversementRecord): HistoryRow | undefined {
  const mandant = mandantById(record.mandantId);
  if (!mandant) return undefined;
  return {
    id: record.id,
    mandantId: record.mandantId,
    name: mandant.name,
    kind: mandant.kind,
    mandateRenewal: mandant.mandateRenewal,
    period: record.period,
    paidOn: record.paidOn,
    lots: record.lots,
    collectedMinor: record.collectedMinor,
    feeMinor: record.feeMinor,
    netMinor: record.netMinor,
    ibanLast4: mandant.ibanLast4,
  };
}

export function reversements(state: FinancesState): Reversements {
  const rows = MANDANTS.flatMap((mandant) => reversementRow(state, mandant.id) ?? []);
  const unpaidLines = MANDANTS.flatMap((mandant) => mandantFigures(state, mandant.id, CURRENT_PERIOD).lines).filter((line) => line.remainingMinor > 0);
  const history = state.records
    .flatMap((record) => historyRow(record) ?? [])
    .sort((a, b) => (a.paidOn < b.paidOn ? 1 : a.paidOn > b.paidOn ? -1 : a.name.localeCompare(b.name, "fr")));
  const latest = history[0];
  const latestCount = latest ? history.filter((row) => row.period === latest.period).length : 0;
  const batch = currentBatch(state);
  return {
    period: CURRENT_PERIOD,
    executionOn: executionDateOf(CURRENT_PERIOD),
    rateLabel: rateSummary(state),
    rows,
    history,
    unpaid: {
      count: unpaidLines.length,
      totalMinor: sum(unpaidLines.map((line) => line.remainingMinor)),
      labels: unpaidLines.map((line) => lotById(line.lotId)?.label ?? line.lotId),
    },
    lastBatch: latest
      ? { executedOn: latest.paidOn, periodLabel: formatPeriod(latest.period).split(" ")[0] ?? "", count: latestCount, executed: latest.paidOn <= DEMO_TODAY }
      : null,
    batchStatus: batch?.status ?? null,
  };
}

export function lotView(state: FinancesState): TransferLot | null {
  const batch = currentBatch(state);
  if (!batch) return null;
  const rows = MANDANTS.flatMap((mandant) => reversementRow(state, mandant.id) ?? []);
  const member = (row: ReversementRow) => batch.mandantIds.includes(row.mandantId);
  const included = rows.filter((row) => member(row) && row.netMinor > 0 && (batch.status === "valide" ? row.status === "reverse" : row.status === "a_reverser"));
  const excluded = rows
    .filter((row) => !included.includes(row))
    .map((row) => ({
      mandantId: row.mandantId,
      name: row.name,
      reason: row.status === "bloque" ? `Reversement bloqué : ${row.blockedReason ?? "motif non renseigné"}` : row.status === "reverse" ? "Déjà reversé" : row.netMinor <= 0 ? "Aucun encaissement à reverser" : "Non inclus dans ce lot",
      canInclude: batch.status === "brouillon" && row.status === "a_reverser" && row.netMinor > 0,
    }));
  const collectedMinor = sum(rows.map((row) => row.collectedMinor));
  const totalMinor = sum(included.map((row) => row.netMinor));
  const feesMinor = sum(included.map((row) => row.feeMinor));
  return {
    id: batch.id,
    period: batch.period,
    status: batch.status,
    executionOn: batch.executionOn,
    validatedAt: batch.validatedAt,
    transfers: included.map((row) => ({
      mandantId: row.mandantId,
      name: row.name,
      kind: row.kind,
      ibanLast4: row.ibanLast4,
      label: `Loyers ${CURRENT_PERIOD.slice(5)}/${CURRENT_PERIOD.slice(0, 4)}, ${mandantById(row.mandantId)?.mandateRef ?? ""}`,
      netMinor: row.netMinor,
      mandateRenewal: row.mandateRenewal,
    })),
    lotsCount: sum(included.map((row) => row.lots)),
    totalMinor,
    feesMinor,
    collectedMinor,
    retainedMinor: collectedMinor - totalMinor - feesMinor,
    excluded,
    accountLast4: AGENCY.mandantsAccountLast4,
  };
}

export function reversementDetail(state: FinancesState, mandantId: string): ReversementDetail | null {
  const mandant = mandantById(mandantId);
  const row = reversementRow(state, mandantId);
  if (!mandant || !row) return null;
  const figures = mandantFigures(state, mandantId, CURRENT_PERIOD);
  const batch = currentBatch(state);
  const { ht, vat } = splitVat(row.feeMinor, VAT_BASIS_POINTS);
  const unpaid = figures.lines.filter((line) => line.remainingMinor > 0);
  return {
    mandantId,
    name: mandant.name,
    kind: mandant.kind,
    mateRef: mandant.mandateRef,
    ibanLast4: mandant.ibanLast4,
    period: CURRENT_PERIOD,
    status: row.status,
    scheduledOn: row.scheduledOn,
    blockedReason: row.blockedReason,
    inBatch: batch?.mandantIds.includes(mandantId) ?? false,
    batchStatus: batch?.status ?? null,
    rateBp: figures.rateBp,
    calledMinor: figures.calledMinor,
    collectedMinor: row.collectedMinor,
    feeMinor: row.feeMinor,
    htMinor: ht,
    vatMinor: vat,
    worksMinor: figures.worksMinor,
    netMinor: row.netMinor,
    pendingFeeMinor: figures.pendingFeeMinor,
    lines: figures.lines.map((line) => {
      const lot = lotById(line.lotId);
      return {
        lotId: line.lotId,
        lotLabel: lot?.label ?? line.lotId,
        lotDescription: lot?.description ?? "",
        tenantName: (lot ? tenantById(lot.tenantId)?.name : undefined) ?? "",
        paidOn: line.paidOn,
        calledMinor: line.calledMinor,
        collectedMinor: line.collectedMinor,
        feeMinor: line.feeMinor,
        netMinor: line.collectedMinor - line.feeMinor,
      };
    }),
    unpaidLabels: unpaid.map((line) => lotById(line.lotId)?.label ?? line.lotId),
    history: state.records
      .filter((record) => record.mandantId === mandantId)
      .sort((a, b) => (a.period < b.period ? 1 : -1))
      .map((record) => ({ id: record.id, period: record.period, paidOn: record.paidOn, feeMinor: record.feeMinor, netMinor: record.netMinor })),
  };
}
