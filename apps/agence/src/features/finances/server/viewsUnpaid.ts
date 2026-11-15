import { DEMO_TODAY, periodOf } from "@/features/shared/dates";
import { MANDANTS, lotById, mandantById, tenantById } from "@/features/shared/directory";
import { sum } from "@/features/shared/money";
import { installmentLabel, joinLabels } from "../format";
import type { ImpayeDetail, Impayes, UnpaidRow } from "../schemas";
import { CURRENT_PERIOD } from "./model";
import type { CaseEvent, FinancesState } from "./model";
import {
  caseOf,
  feeFor,
  lastReminderOn,
  mandantFigures,
  nextStepOf,
  overdueDays,
  overdueInstallments,
  reminderEvents,
  remainingOf,
  schemeAt,
  unpaidLotIds,
} from "./rules";

function rowOf(state: FinancesState, lotId: string): UnpaidRow | undefined {
  const lot = lotById(lotId);
  const overdue = overdueInstallments(state, lotId);
  const oldest = overdue[0];
  if (!lot || !oldest) return undefined;
  const unpaidCase = caseOf(state, lotId);
  const days = overdueDays(oldest.dueOn);
  return {
    lotId,
    lotLabel: lot.label,
    tenantName: tenantById(lot.tenantId)?.name ?? "",
    mandantId: lot.mandantId,
    mandantName: mandantById(lot.mandantId)?.name ?? "",
    dueOn: oldest.dueOn,
    remainingMinor: sum(overdue.map((installment) => remainingOf(state, installment))),
    overdueDays: days,
    lastReminderOn: lastReminderOn(unpaidCase),
    reminders: reminderEvents(unpaidCase).length,
    nextStep: nextStepOf(unpaidCase, days),
  };
}

export function impayes(state: FinancesState): Impayes {
  const rows = unpaidLotIds(state)
    .flatMap((lotId) => rowOf(state, lotId) ?? [])
    .sort((a, b) => b.overdueDays - a.overdueDays);
  const over20 = rows.filter((row) => row.overdueDays > 20);
  const thisMonth = rows.map((row) => reminderEvents(caseOf(state, row.lotId)).filter((event) => periodOf(event.date) === periodOf(DEMO_TODAY)).length);
  return {
    totalMinor: sum(rows.map((row) => row.remainingMinor)),
    mandantsCount: new Set(rows.map((row) => row.mandantId)).size,
    over20Minor: sum(over20.map((row) => row.remainingMinor)),
    over20Label: over20.length === 0 ? "Aucun dossier" : over20.length === 1 ? `${over20[0]?.lotLabel ?? ""}, ${over20[0]?.tenantName ?? ""}` : `${String(over20.length)} dossiers`,
    remindersThisMonth: sum(thisMonth),
    remindersCases: thisMonth.filter((count) => count > 0).length,
    rows,
    mandants: MANDANTS.map((mandant) => ({ value: mandant.id, label: mandant.name })),
  };
}

function plannedNotice(dueOn: string | null): CaseEvent {
  return {
    id: "planned-notice",
    kind: "mise_en_demeure",
    date: dueOn ?? DEMO_TODAY,
    title: "Mise en demeure par courrier recommandé",
    detail: "si aucun paiement reçu",
    badge: { label: "Prévue", tone: "info" },
  };
}

export function impayeDetail(state: FinancesState, lotId: string): ImpayeDetail | null {
  const lot = lotById(lotId);
  const row = rowOf(state, lotId);
  const overdue = overdueInstallments(state, lotId);
  const oldest = overdue[0];
  const mandant = lot ? mandantById(lot.mandantId) : undefined;
  if (!lot || !row || !oldest || !mandant) return null;
  const unpaidCase = caseOf(state, lotId);
  const events = unpaidCase.events
    .map((event) => ({ ...event, planned: false }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const showPlanned = !unpaidCase.noticeOn && row.nextStep.recommendation === "Mise en demeure recommandée";
  const figures = mandantFigures(state, lot.mandantId, CURRENT_PERIOD);
  const scheme = schemeAt(state, lot.mandantId, DEMO_TODAY);
  return {
    lotId,
    lotLabel: lot.label,
    address: lot.address,
    tenantName: row.tenantName,
    mandantId: mandant.id,
    mandantName: mandant.name,
    mandantKind: mandant.kind,
    installmentLabel: installmentLabel(oldest.period),
    dueOn: oldest.dueOn,
    calledMinor: sum(overdue.map((installment) => installment.calledMinor)),
    remainingMinor: row.remainingMinor,
    rentMinor: lot.rentMinor,
    chargesMinor: lot.chargesMinor,
    depositMinor: lot.rentMinor * 2,
    pendingFeeMinor: sum(overdue.map((installment) => feeFor(remainingOf(state, installment), installment, scheme))),
    overdueDays: row.overdueDays,
    reminders: row.reminders,
    lastReminderOn: row.lastReminderOn,
    nextStep: row.nextStep,
    events: showPlanned ? [...events, { ...plannedNotice(row.nextStep.dueOn), planned: true }] : events,
    plan: unpaidCase.plan,
    noticeOn: unpaidCase.noticeOn,
    impact: {
      lotsLabel: joinLabels(figures.lines.filter((line) => line.collectedMinor > 0).map((line) => lotById(line.lotId)?.label ?? line.lotId)) || "aucun lot encaissé",
      rateBp: figures.rateBp,
      collectedMinor: figures.collectedMinor,
      feeMinor: figures.feeMinor,
      netMinor: figures.netMinor,
    },
  };
}
