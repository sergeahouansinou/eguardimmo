import { DEMO_TODAY } from "@/features/shared/dates";
import { MANDANTS, lotById, mandantById, tenantById } from "@/features/shared/directory";
import { DemoServerError } from "@/features/shared/errors";
import { formatMoney, sum } from "@/features/shared/money";
import type { MandantStatement } from "@/features/shared/statement";
import { executionDateOf, installmentLabel, periodOptions, rateText } from "../format";
import type { Encaissements, OpenInstallment, PaymentPreview, PaymentRow } from "../schemas";
import { previewPaymentSchema } from "../inputs";
import type { PreviewPaymentInput } from "../inputs";
import { CURRENT_PERIOD } from "./model";
import type { FinancesState, Payment } from "./model";
import { parseInput } from "./parse";
import { caseOf, feeFor, installmentById, mandantFigures, overdueInstallments, reminderEvents, remainingOf, schemeAt } from "./rules";

export const PERIODS = [CURRENT_PERIOD, "2026-10"] as const;

export function rateSummary(state: FinancesState): string {
  const rates = new Set(MANDANTS.map((mandant) => schemeAt(state, mandant.id, DEMO_TODAY).rateBp));
  const [only] = [...rates];
  return rates.size === 1 && only !== undefined ? `${rateText(only)} TTC des loyers encaissés` : "Selon le barème de chaque mandat";
}

function paymentRow(state: FinancesState, payment: Payment): PaymentRow {
  const lot = lotById(payment.lotId);
  const installment = installmentById(state, payment.installmentId);
  return {
    id: payment.id,
    lotId: payment.lotId,
    lotLabel: lot?.label ?? payment.lotId,
    tenantName: (lot ? tenantById(lot.tenantId)?.name : undefined) ?? "Locataire inconnu",
    mandantId: lot?.mandantId ?? "",
    mandantName: (lot ? mandantById(lot.mandantId)?.name : undefined) ?? "",
    installmentLabel: installment ? installmentLabel(installment.period) : "",
    installmentCalledMinor: installment?.calledMinor ?? 0,
    receivedOn: payment.receivedOn,
    mode: payment.mode,
    reference: payment.reference,
    note: payment.note,
    amountMinor: payment.amountMinor,
    feeMinor: payment.feeMinor,
    status: payment.status,
    receipt: payment.receipt,
    rejectionReason: payment.rejectionReason,
  };
}

export function encaissements(state: FinancesState, period: string): Encaissements {
  if (!PERIODS.some((item) => item === period)) throw new DemoServerError("periode_inconnue", "Période inconnue.");
  const installments = state.installments.filter((installment) => installment.period === period);
  const ids = new Set(installments.map((installment) => installment.id));
  const payments = state.payments.filter((payment) => ids.has(payment.installmentId));
  const active = payments.filter((payment) => payment.status !== "rejete");
  const calledMinor = sum(installments.map((installment) => installment.calledMinor));
  const collectedMinor = sum(active.map((payment) => payment.amountMinor));
  return {
    period,
    periodLabel: installmentLabel(period),
    periods: periodOptions(PERIODS),
    calledMinor,
    collectedMinor,
    feeMinor: sum(active.map((payment) => payment.feeMinor)),
    remainingMinor: calledMinor - collectedMinor,
    unpaidCount: installments.filter((installment) => remainingOf(state, installment) > 0).length,
    rateLabel: rateSummary(state),
    payments: [...payments].sort((a, b) => (a.receivedOn < b.receivedOn ? 1 : a.receivedOn > b.receivedOn ? -1 : 0)).map((payment) => paymentRow(state, payment)),
    mandants: MANDANTS.map((mandant) => ({ value: mandant.id, label: mandant.name })),
  };
}

export function openInstallments(state: FinancesState): OpenInstallment[] {
  return state.installments
    .filter((installment) => remainingOf(state, installment) > 0)
    .flatMap((installment) => {
      const lot = lotById(installment.lotId);
      if (!lot) return [];
      return [
        {
          installmentId: installment.id,
          lotId: lot.id,
          lotLabel: lot.label,
          tenantName: tenantById(lot.tenantId)?.name ?? "",
          mandantId: lot.mandantId,
          mandantName: mandantById(lot.mandantId)?.name ?? "",
          label: installmentLabel(installment.period),
          dueOn: installment.dueOn,
          calledMinor: installment.calledMinor,
          remainingMinor: remainingOf(state, installment),
        },
      ];
    })
    .sort((a, b) => (a.dueOn < b.dueOn ? -1 : 1));
}

export function amountError(state: FinancesState, installmentId: string, amountMinor: number): string | null {
  const installment = installmentById(state, installmentId);
  if (!installment) return "Choisissez une échéance.";
  if (amountMinor <= 0) return "Saisissez un montant supérieur à 0.";
  const remaining = remainingOf(state, installment);
  if (amountMinor > remaining) return `Le montant dépasse le reste dû (${formatMoney(remaining)}).`;
  return null;
}

export function previewPayment(state: FinancesState, input: PreviewPaymentInput): PaymentPreview {
  const { installmentId, amountMinor, receivedOn } = parseInput(previewPaymentSchema, input);
  const installment = installmentById(state, installmentId);
  const lot = installment ? lotById(installment.lotId) : undefined;
  if (!installment || !lot) {
    return { error: "Choisissez une échéance.", remainingAfterMinor: 0, feeMinor: 0, netMinor: 0, mandantName: "", lotLabel: "", closesCase: false };
  }
  const error = amountError(state, installmentId, amountMinor);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(receivedOn) ? receivedOn : DEMO_TODAY;
  const feeMinor = error ? 0 : feeFor(amountMinor, installment, schemeAt(state, lot.mandantId, date));
  const remainingAfterMinor = error ? remainingOf(state, installment) : remainingOf(state, installment) - amountMinor;
  const otherOpen = overdueInstallments(state, lot.id).filter((item) => item.id !== installment.id);
  return {
    error,
    remainingAfterMinor,
    feeMinor,
    netMinor: error ? 0 : amountMinor - feeMinor,
    mandantName: mandantById(lot.mandantId)?.name ?? "",
    lotLabel: lot.label,
    closesCase: !error && remainingAfterMinor === 0 && otherOpen.length === 0,
  };
}

export function statements(state: FinancesState, period: string): MandantStatement[] {
  if (!state.installments.some((installment) => installment.period === period)) return [];
  return MANDANTS.map((mandant) => {
    const figures = mandantFigures(state, mandant.id, period);
    const lines = figures.lines.flatMap((line) => {
      const lot = lotById(line.lotId);
      if (!lot) return [];
      const reminders = line.remainingMinor > 0 ? reminderEvents(caseOf(state, lot.id)).length : 0;
      return [
        {
          lotId: lot.id,
          lotLabel: lot.label,
          lotDescription: lot.description,
          tenantName: tenantById(lot.tenantId)?.name ?? "",
          paidOn: line.paidOn,
          calledMinor: line.calledMinor,
          collectedMinor: line.collectedMinor,
          feeMinor: line.feeMinor,
          netMinor: line.collectedMinor - line.feeMinor,
          unpaidSince: line.remainingMinor > 0 ? line.installment.dueOn : null,
          reminders,
        },
      ];
    });
    return {
      mandantId: mandant.id,
      mandantName: mandant.name,
      mandantKind: mandant.kind,
      mandateRef: mandant.mandateRef,
      ibanLast4: mandant.ibanLast4,
      period,
      feeRateBasisPoints: figures.rateBp,
      lines,
      calledMinor: figures.calledMinor,
      collectedMinor: figures.collectedMinor,
      feeMinor: figures.feeMinor,
      netMinor: figures.netMinor,
      worksDeductedMinor: figures.worksMinor,
      receipts: figures.lines.reduce((count, line) => count + line.payments.filter((payment) => payment.receipt).length, 0),
      transferDate: executionDateOf(period),
    };
  });
}
