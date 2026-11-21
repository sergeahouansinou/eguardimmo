import { settle } from "@/features/equipe/settle";
import { DemoServerError } from "@/features/shared/errors";
import { DEMO_NOW, DEMO_TODAY, addDays, daysBetween } from "@/features/shared/dates";
import { LOTS } from "@/features/shared/directory";
import { parseInput } from "@/features/equipe/zodErrors";
import type { EquipeDemo } from "@/features/equipe/source";
import type { Store } from "@/features/shared/store";
import { PLANS, planById } from "./plans";
import type { PlanDefinition, PlanId } from "./plans";
import type { CompteSource } from "./source";
import { addPaymentMethodInputSchema, billingInputSchema, changePlanInputSchema } from "./subscriptionSchemas";
import type { Billing, BillingPeriod, PaymentMethod, Plan, SubscriptionView } from "./subscriptionSchemas";

export interface SubscriptionState {
  planId: PlanId;
  billingPeriod: BillingPeriod;
  trialStart: string;
  trialEnd: string;
  paymentMethods: readonly PaymentMethod[];
  billing: Billing;
  storageUsedMb: number;
}

export const INITIAL_SUBSCRIPTION: SubscriptionState = {
  planId: "gratuit",
  billingPeriod: "monthly",
  trialStart: "2026-11-05",
  trialEnd: "2026-11-20",
  paymentMethods: [],
  billing: {
    company: "Cabinet Delmas Immobilier",
    address: "24 avenue de la République, 75011 Paris",
    vatNumber: "FR40912345678",
    email: "compta@delmas-immobilier.example",
  },
  storageUsedMb: 800,
};

const DEMO_METHODS = {
  card: { label: "Visa •••• 4242", prefix: "carte" },
  sepa: { label: "Mandat SEPA •••• 3031", prefix: "mandat" },
} as const;

function amountOf(plan: PlanDefinition, period: BillingPeriod): number {
  return period === "yearly" ? plan.yearlyMinor : plan.monthlyMinor;
}

function entitledPlan(state: SubscriptionState, plan: PlanDefinition): PlanDefinition {
  const trialActive = DEMO_TODAY <= state.trialEnd;
  return trialActive && plan.id === "gratuit" ? (planById("gold") ?? plan) : plan;
}

function toPlan(plan: PlanDefinition, currentId: PlanId): Plan {
  return {
    id: plan.id,
    name: plan.name,
    monthlyMinor: plan.monthlyMinor,
    yearlyMinor: plan.yearlyMinor,
    lots: plan.lots,
    seats: plan.seats,
    features: [...plan.features],
    current: plan.id === currentId,
  };
}

function currentPlan(state: SubscriptionState): PlanDefinition {
  const plan = planById(state.planId);
  if (!plan) throw new DemoServerError("not_found", "Formule inconnue.");
  return plan;
}

export function subscriptionDemo(
  store: Store<SubscriptionState>,
  equipe: EquipeDemo,
): Pick<CompteSource, "subscription" | "changePlan" | "addPaymentMethod" | "removePaymentMethod" | "saveBilling"> {
  return {
    subscription: (): Promise<SubscriptionView> => settle(() => {
      const state = store.get();
      const plan = currentPlan(state);
      const stats = equipe.stats();
      const entitled = entitledPlan(state, plan);
      return {
        planId: plan.id,
        planName: plan.name,
        trial: {
          startDate: state.trialStart,
          endDate: state.trialEnd,
          daysLeft: daysBetween(DEMO_TODAY, state.trialEnd),
          elapsedDays: daysBetween(state.trialStart, DEMO_TODAY),
          totalDays: daysBetween(state.trialStart, state.trialEnd),
        },
        billingPeriod: state.billingPeriod,
        firstCharge: {
          date: addDays(state.trialEnd, 1),
          amountMinor: amountOf(plan, state.billingPeriod),
          period: state.billingPeriod,
        },
        plans: PLANS.map((candidate) => toPlan(candidate, plan.id)),
        paymentMethods: [...state.paymentMethods],
        billing: state.billing,
        usage: {
          lots: { used: LOTS.length, limit: entitled.lots },
          seats: { used: stats.activeCount, limit: entitled.seats },
          storage: { usedMb: state.storageUsedMb, limitMb: entitled.storageMb },
        },
      };
    }),

    changePlan: (input) => settle(() => {
      const data = parseInput(changePlanInputSchema, input);
      const target = planById(data.planId);
      if (!target) throw new DemoServerError("invalid_plan", "Formule inconnue.");
      const stats = equipe.stats();
      const seatsUsed = stats.activeCount + stats.pendingCount;
      if (target.seats !== null && seatsUsed > target.seats) {
        throw new DemoServerError(
          "seat_limit",
          `La formule ${target.name} accepte ${String(target.seats)} collaborateurs : retirez ${String(seatsUsed - target.seats)} collaborateur(s) ou invitation(s) avant de la choisir.`,
        );
      }
      if (target.lots !== null && LOTS.length > target.lots) {
        throw new DemoServerError("lot_limit", `La formule ${target.name} accepte ${String(target.lots)} lots.`);
      }
      store.update((state) => ({ ...state, planId: target.id, billingPeriod: data.period }));
      equipe.setSeatPlan({ name: target.name, seats: target.seats });
      return { planId: target.id, amountMinor: amountOf(target, data.period), effectiveAt: DEMO_NOW };
    }),

    addPaymentMethod: (input) => settle(() => {
      const data = parseInput(addPaymentMethodInputSchema, input);
      const demo = DEMO_METHODS[data.kind];
      const state = store.get();
      if (state.paymentMethods.some((method) => method.kind === data.kind)) {
        throw new DemoServerError("duplicate", "Ce type de moyen de paiement est déjà enregistré.");
      }
      const method: PaymentMethod = { id: `${demo.prefix}-${String(state.paymentMethods.length + 1)}`, kind: data.kind, label: demo.label, addedAt: DEMO_TODAY };
      store.update((current) => ({ ...current, paymentMethods: [...current.paymentMethods, method] }));
      return { id: method.id };
    }),

    removePaymentMethod: (methodId) => settle(() => {
      if (!store.get().paymentMethods.some((method) => method.id === methodId)) {
        throw new DemoServerError("not_found", "Ce moyen de paiement n'existe plus.");
      }
      store.update((state) => ({ ...state, paymentMethods: state.paymentMethods.filter((method) => method.id !== methodId) }));
      return { id: methodId };
    }),

    saveBilling: (input) => settle(() => {
      const data = parseInput(billingInputSchema, input);
      store.update((state) => ({ ...state, billing: data }));
      return data;
    }),
  };
}
