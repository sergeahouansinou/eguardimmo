import { DEMO_TODAY, formatDate } from "@/features/shared/dates";
import { lotById, mandantById } from "@/features/shared/directory";
import { DemoServerError } from "@/features/shared/errors";
import type { Store } from "@/features/shared/store";
import { formatMoney } from "@/features/shared/money";
import { MODE_LABELS } from "../format";
import { paymentIdSchema, recordPaymentSchema, rejectPaymentSchema } from "../inputs";
import type { RecordPaymentInput, RejectPaymentInput } from "../inputs";
import type { CaseEvent, FinancesState, Payment, UnpaidCase } from "./model";
import { parseInput } from "./parse";
import { defaultCase, feeFor, installmentById, overdueInstallments, remainingOf, schemeAt } from "./rules";
import { amountError } from "./viewsPayments";

export interface RecordPaymentResult {
  paymentId: string;
  remainingAfterMinor: number;
  feeMinor: number;
  closedCase: boolean;
}

export function upsertCase(state: FinancesState, lotId: string, change: (current: UnpaidCase) => UnpaidCase): FinancesState {
  const current = state.cases.find((item) => item.lotId === lotId) ?? defaultCase(state, lotId);
  const next = change(current);
  const exists = state.cases.some((item) => item.lotId === lotId);
  return { ...state, cases: exists ? state.cases.map((item) => (item.lotId === lotId ? next : item)) : [...state.cases, next] };
}

export function caseEvent(current: UnpaidCase, partial: Omit<CaseEvent, "id" | "date">): CaseEvent {
  return { id: `evt-${current.lotId}-${String(current.events.length + 1)}`, date: DEMO_TODAY, ...partial };
}

function nextSequence(state: FinancesState, by = 1): FinancesState {
  return { ...state, sequence: state.sequence + by };
}

export function paymentCommands(store: Store<FinancesState>) {
  const processed = new Map<string, RecordPaymentResult>();

  function recordPayment(input: RecordPaymentInput): RecordPaymentResult {
    const parsed = parseInput(recordPaymentSchema, input);
    const replay = processed.get(parsed.idempotencyKey);
    if (replay) return replay;
    const state = store.get();
    const installment = installmentById(state, parsed.installmentId);
    const lot = installment ? lotById(installment.lotId) : undefined;
    if (!installment || !lot) throw new DemoServerError("echeance_inconnue", "Cette échéance n'existe pas.", { installmentId: "Choisissez une échéance." });
    if (parsed.receivedOn > DEMO_TODAY) {
      throw new DemoServerError("date_future", "La date de réception ne peut pas être dans le futur.", { receivedOn: "La date de réception ne peut pas être dans le futur." });
    }
    const error = amountError(state, installment.id, parsed.amountMinor);
    if (error) throw new DemoServerError("montant_invalide", error, { amountMinor: error });
    const feeMinor = feeFor(parsed.amountMinor, installment, schemeAt(state, lot.mandantId, parsed.receivedOn));
    const payment: Payment = {
      id: `pay-${String(state.sequence)}`,
      installmentId: installment.id,
      lotId: lot.id,
      receivedOn: parsed.receivedOn,
      mode: parsed.mode,
      reference: parsed.reference,
      note: parsed.note,
      amountMinor: parsed.amountMinor,
      feeMinor,
      status: parsed.mode === "cheque" || parsed.mode === "especes" ? "a_rapprocher" : "recu",
      receipt: parsed.receipt,
      notifyTenant: parsed.notifyTenant,
      notifyMandant: parsed.notifyMandant,
      rejectionReason: null,
    };
    const remainingAfterMinor = remainingOf(state, installment) - parsed.amountMinor;
    const withPayment = nextSequence({ ...state, payments: [...state.payments, payment] });
    const stillOverdue = overdueInstallments(withPayment, lot.id).length > 0;
    const hadCase = withPayment.cases.some((item) => item.lotId === lot.id);
    const wasOverdue = overdueInstallments(state, lot.id).length > 0;
    const closedCase = wasOverdue && !stillOverdue;
    const next =
      hadCase || wasOverdue
        ? upsertCase(withPayment, lot.id, (current) => ({
            ...current,
            status: stillOverdue ? "ouvert" : "clos",
            events: [
              ...current.events,
              caseEvent(current, {
                kind: "paiement",
                title: closedCase ? "Paiement reçu, impayé clos" : "Paiement reçu",
                detail: `${formatMoney(parsed.amountMinor)} · ${MODE_LABELS[parsed.mode]} · reçu le ${formatDate(parsed.receivedOn)}`,
                badge: closedCase ? { label: "Réglé", tone: "success" } : null,
              }),
            ],
          }))
        : withPayment;
    store.update(() => next);
    const result: RecordPaymentResult = { paymentId: payment.id, remainingAfterMinor, feeMinor, closedCase };
    processed.set(parsed.idempotencyKey, result);
    return result;
  }

  function findPayment(paymentId: string): Payment {
    const payment = store.get().payments.find((item) => item.id === paymentId);
    if (!payment) throw new DemoServerError("paiement_inconnu", "Ce paiement n'existe pas.");
    return payment;
  }

  function reconcilePayment(input: { paymentId: string }): void {
    const { paymentId } = parseInput(paymentIdSchema, input);
    const payment = findPayment(paymentId);
    if (payment.status === "rejete") throw new DemoServerError("paiement_rejete", "Un paiement rejeté ne peut pas être rapproché.");
    store.update((state) => ({ ...state, payments: state.payments.map((item) => (item.id === paymentId ? { ...item, status: "recu" } : item)) }));
  }

  function rejectPayment(input: RejectPaymentInput): void {
    const { paymentId, reason } = parseInput(rejectPaymentSchema, input);
    const payment = findPayment(paymentId);
    if (payment.status === "rejete") return;
    const rejected = store.update((state) =>
      nextSequence({ ...state, payments: state.payments.map((item) => (item.id === paymentId ? { ...item, status: "rejete", rejectionReason: reason } : item)) }),
    );
    const lot = lotById(payment.lotId);
    if (!lot || overdueInstallments(rejected, lot.id).length === 0) return;
    store.update((state) =>
      upsertCase(state, lot.id, (current) => ({
        ...current,
        status: "ouvert",
        events: [
          ...current.events,
          caseEvent(current, {
            kind: "rejet",
            title: "Paiement rejeté, dossier rouvert",
            detail: `${formatMoney(payment.amountMinor)} · ${reason} · ${mandantById(lot.mandantId)?.name ?? ""}`,
            badge: { label: "Impayé", tone: "danger" },
          }),
        ],
      })),
    );
  }

  return { recordPayment, reconcilePayment, rejectPayment };
}
