import { DEMO_TODAY, addMonths, formatDate } from "@/features/shared/dates";
import { CURRENT_USER, lotById, mandantById } from "@/features/shared/directory";
import { DemoServerError } from "@/features/shared/errors";
import type { Store } from "@/features/shared/store";
import { formatMoney, sum } from "@/features/shared/money";
import { CHANNEL_LABELS } from "../format";
import { lotIdSchema, planSchema, reminderSchema } from "../inputs";
import type { PlanInput, ReminderInput } from "../inputs";
import type { FinancesState, PlanLine } from "./model";
import { parseInput } from "./parse";
import { caseOf, overdueInstallments, reminderEvents, remainingOf } from "./rules";
import { caseEvent, upsertCase } from "./commandsPayments";

function requireUnpaid(state: FinancesState, lotId: string): number {
  const overdue = overdueInstallments(state, lotId);
  if (!lotById(lotId) || overdue.length === 0) {
    throw new DemoServerError("dossier_introuvable", "Cet impayé n'existe plus. Il a peut-être été régularisé.");
  }
  return sum(overdue.map((installment) => remainingOf(state, installment)));
}

export function splitPlan(totalMinor: number, installments: number, firstDueOn: string): PlanLine[] {
  const base = Math.floor(totalMinor / installments);
  const remainder = totalMinor - base * installments;
  return Array.from({ length: installments }, (_, index) => ({
    dueOn: addMonths(firstDueOn, index),
    amountMinor: index === 0 ? base + remainder : base,
  }));
}

export function unpaidCommands(store: Store<FinancesState>) {
  function sendReminders(input: ReminderInput): { sent: number } {
    const { lotIds, channel, message } = parseInput(reminderSchema, input);
    const unique = [...new Set(lotIds)];
    unique.forEach((lotId) => requireUnpaid(store.get(), lotId));
    unique.forEach((lotId) => {
      store.update((state) =>
        upsertCase(state, lotId, (current) => {
          const count = reminderEvents(current).length + 1;
          return {
            ...current,
            status: "ouvert",
            events: [
              ...current.events,
              caseEvent(current, {
                kind: "relance",
                title: `Relance ${String(count)} par ${CHANNEL_LABELS[channel].toLowerCase()}`,
                detail: `« ${message.length > 60 ? `${message.slice(0, 57)}…` : message} » · ${CURRENT_USER.name}`,
                badge: { label: `Relance ${String(count)}`, tone: "neutral" },
              }),
            ],
          };
        }),
      );
    });
    return { sent: unique.length };
  }

  function proposePlan(input: PlanInput): { lines: PlanLine[] } {
    const { lotId, installments, firstDueOn } = parseInput(planSchema, input);
    const total = requireUnpaid(store.get(), lotId);
    if (firstDueOn <= DEMO_TODAY) {
      throw new DemoServerError("date_passee", "La première échéance doit être postérieure à aujourd'hui.", {
        firstDueOn: "La première échéance doit être postérieure à aujourd'hui.",
      });
    }
    const lines = splitPlan(total, installments, firstDueOn);
    store.update((state) =>
      upsertCase(state, lotId, (current) => ({
        ...current,
        plan: { proposedOn: DEMO_TODAY, lines },
        events: [
          ...current.events,
          caseEvent(current, {
            kind: "echeancier",
            title: "Échéancier proposé au locataire",
            detail: `${String(installments)} mensualités, la première de ${formatMoney(lines[0]?.amountMinor ?? 0)} le ${formatDate(firstDueOn)}`,
            badge: { label: "Proposé", tone: "info" },
          }),
        ],
      })),
    );
    return { lines };
  }

  function prepareNotice(input: { lotId: string }): void {
    const { lotId } = parseInput(lotIdSchema, input);
    requireUnpaid(store.get(), lotId);
    if (caseOf(store.get(), lotId).noticeOn) return;
    store.update((state) =>
      upsertCase(state, lotId, (current) => ({
        ...current,
        noticeOn: DEMO_TODAY,
        events: [
          ...current.events,
          caseEvent(current, {
            kind: "mise_en_demeure",
            title: "Mise en demeure par courrier recommandé",
            detail: `avec accusé de réception · ${CURRENT_USER.name}`,
            badge: { label: "Envoyée", tone: "info" },
          }),
        ],
      })),
    );
  }

  function informMandant(input: { lotId: string }): void {
    const { lotId } = parseInput(lotIdSchema, input);
    requireUnpaid(store.get(), lotId);
    const mandant = mandantById(lotById(lotId)?.mandantId ?? "");
    store.update((state) =>
      upsertCase(state, lotId, (current) => ({
        ...current,
        events: [...current.events, caseEvent(current, { kind: "mandant", title: "Mandant informé", detail: `${mandant?.name ?? "Mandant"}, via son espace`, badge: null })],
      })),
    );
  }

  return { sendReminders, proposePlan, prepareNotice, informMandant };
}
