import { VAT_BASIS_POINTS } from "@/features/shared/agencyDefaults";
import { DEMO_TODAY, addDays, daysBetween, formatDate } from "@/features/shared/dates";
import { LOTS, MANDANTS, lotById } from "@/features/shared/directory";
import type { Mandant } from "@/features/shared/directory";
import { applyRate, formatMoney, splitVat, sum } from "@/features/shared/money";
import type { FeeScheme, FinancesState, Installment, Payment, UnpaidCase } from "./model";

export interface LotFigures {
  lotId: string;
  installment: Installment;
  calledMinor: number;
  collectedMinor: number;
  feeMinor: number;
  remainingMinor: number;
  paidOn: string | null;
  payments: Payment[];
}

export interface MandantFigures {
  mandantId: string;
  lines: LotFigures[];
  calledMinor: number;
  collectedMinor: number;
  feeMinor: number;
  htMinor: number;
  vatMinor: number;
  worksMinor: number;
  netMinor: number;
  pendingFeeMinor: number;
  unpaidLotIds: string[];
  rateBp: number;
}

export interface NextStep {
  label: string;
  dueOn: string | null;
  urgent: boolean;
  recommendation: string;
}

export function installmentById(state: FinancesState, id: string): Installment | undefined {
  return state.installments.find((installment) => installment.id === id);
}

export function activePayments(state: FinancesState, installmentId: string): Payment[] {
  return state.payments.filter((payment) => payment.installmentId === installmentId && payment.status !== "rejete");
}

export function remainingOf(state: FinancesState, installment: Installment): number {
  return Math.max(0, installment.calledMinor - sum(activePayments(state, installment.id).map((payment) => payment.amountMinor)));
}

export function schemeAt(state: FinancesState, mandantId: string, dateIso: string): FeeScheme {
  const candidates = state.schemes.filter((scheme) => scheme.mandantId === mandantId && scheme.effectiveFrom <= dateIso);
  const found = candidates.reduce<FeeScheme | undefined>((best, scheme) => (!best || scheme.effectiveFrom >= best.effectiveFrom ? scheme : best), undefined);
  if (!found) throw new RangeError(`Aucun barème pour le mandant ${mandantId}`);
  return found;
}

export function mandantOfMandate(mandateId: string): Mandant | undefined {
  return MANDANTS.find((mandant) => mandant.mandateRef === mandateId);
}

export function feeFor(amountMinor: number, installment: Pick<Installment, "rentMinor" | "calledMinor">, scheme: Pick<FeeScheme, "rateBp" | "base" | "minFeeMinor">): number {
  const base = scheme.base === "rent" ? Math.round((amountMinor * installment.rentMinor) / installment.calledMinor) : amountMinor;
  return Math.min(amountMinor, Math.max(applyRate(base, scheme.rateBp), scheme.minFeeMinor));
}

export function lotFigures(state: FinancesState, lotId: string, period: string): LotFigures | undefined {
  const installment = state.installments.find((item) => item.lotId === lotId && item.period === period);
  if (!installment) return undefined;
  const payments = activePayments(state, installment.id);
  const collectedMinor = sum(payments.map((payment) => payment.amountMinor));
  const dates = payments.map((payment) => payment.receivedOn).sort();
  return {
    lotId,
    installment,
    calledMinor: installment.calledMinor,
    collectedMinor,
    feeMinor: sum(payments.map((payment) => payment.feeMinor)),
    remainingMinor: Math.max(0, installment.calledMinor - collectedMinor),
    paidOn: dates.at(-1) ?? null,
    payments,
  };
}

export function mandantFigures(state: FinancesState, mandantId: string, period: string): MandantFigures {
  const lines = LOTS.filter((lot) => lot.mandantId === mandantId).flatMap((lot) => lotFigures(state, lot.id, period) ?? []);
  const scheme = schemeAt(state, mandantId, DEMO_TODAY);
  const feeMinor = sum(lines.map((line) => line.feeMinor));
  const collectedMinor = sum(lines.map((line) => line.collectedMinor));
  const worksMinor = 0;
  const { ht, vat } = splitVat(feeMinor, VAT_BASIS_POINTS);
  return {
    mandantId,
    lines,
    calledMinor: sum(lines.map((line) => line.calledMinor)),
    collectedMinor,
    feeMinor,
    htMinor: ht,
    vatMinor: vat,
    worksMinor,
    netMinor: collectedMinor - feeMinor - worksMinor,
    pendingFeeMinor: sum(lines.filter((line) => line.remainingMinor > 0).map((line) => feeFor(line.remainingMinor, line.installment, scheme))),
    unpaidLotIds: lines.filter((line) => line.remainingMinor > 0).map((line) => line.lotId),
    rateBp: scheme.rateBp,
  };
}

export function overdueInstallments(state: FinancesState, lotId: string): Installment[] {
  return state.installments
    .filter((installment) => installment.lotId === lotId && installment.dueOn < DEMO_TODAY && remainingOf(state, installment) > 0)
    .sort((a, b) => (a.dueOn < b.dueOn ? -1 : 1));
}

export function unpaidLotIds(state: FinancesState): string[] {
  return LOTS.filter((lot) => overdueInstallments(state, lot.id).length > 0).map((lot) => lot.id);
}

export function overdueDays(dueOn: string): number {
  return Math.max(0, daysBetween(dueOn, DEMO_TODAY));
}

export function reminderEvents(unpaidCase: UnpaidCase) {
  return unpaidCase.events.filter((event) => event.kind === "relance");
}

export function lastReminderOn(unpaidCase: UnpaidCase): string | null {
  const dates = reminderEvents(unpaidCase).map((event) => event.date).sort();
  return dates.at(-1) ?? null;
}

export function nextStepOf(unpaidCase: UnpaidCase, overdue: number): NextStep {
  if (unpaidCase.noticeOn) {
    return { label: `Mise en demeure envoyée le ${formatDate(unpaidCase.noticeOn)}`, dueOn: null, urgent: false, recommendation: "Mise en demeure envoyée" };
  }
  if (unpaidCase.plan) {
    const first = unpaidCase.plan.lines[0]?.dueOn ?? null;
    return {
      label: first ? `Échéancier proposé, première échéance le ${formatDate(first)}` : "Échéancier proposé",
      dueOn: first,
      urgent: false,
      recommendation: "Échéancier proposé",
    };
  }
  const reminders = reminderEvents(unpaidCase).length;
  const last = lastReminderOn(unpaidCase);
  if (reminders === 0 || last === null) {
    return { label: "Première relance à envoyer", dueOn: DEMO_TODAY, urgent: false, recommendation: "Première relance recommandée" };
  }
  if (reminders === 1) {
    const dueOn = addDays(last, 5);
    return { label: `Deuxième relance le ${formatDate(dueOn)}`, dueOn, urgent: false, recommendation: "Deuxième relance recommandée" };
  }
  if (overdue > 20) {
    return { label: "Mise en demeure à envoyer", dueOn: DEMO_TODAY, urgent: true, recommendation: "Mise en demeure recommandée" };
  }
  const dueOn = addDays(last, 6);
  return { label: `Mise en demeure le ${formatDate(dueOn)}`, dueOn, urgent: false, recommendation: "Mise en demeure recommandée" };
}

export function defaultCase(state: FinancesState, lotId: string): UnpaidCase {
  const installment = overdueInstallments(state, lotId)[0];
  const lot = lotById(lotId);
  const dueOn = installment?.dueOn ?? DEMO_TODAY;
  return {
    lotId,
    status: "ouvert",
    plan: null,
    noticeOn: null,
    events: [
      {
        id: `evt-${lotId}-echeance`,
        kind: "echeance",
        date: dueOn,
        title: `Échéance ${installment ? "non réglée" : "à suivre"}`,
        detail: `${formatMoney(installment?.calledMinor ?? (lot ? lot.rentMinor + lot.chargesMinor : 0))} appelés`,
        badge: { label: "Impayé", tone: "danger" },
      },
    ],
  };
}

export function caseOf(state: FinancesState, lotId: string): UnpaidCase {
  return state.cases.find((item) => item.lotId === lotId) ?? defaultCase(state, lotId);
}

export function mandantsOfLots(lotIds: readonly string[]): string[] {
  return [...new Set(lotIds.flatMap((id) => lotById(id)?.mandantId ?? []))];
}

export function mandantName(mandantId: string): string {
  return MANDANTS.find((mandant) => mandant.id === mandantId)?.name ?? mandantId;
}
