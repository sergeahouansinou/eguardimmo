import { z } from "zod";
import { PLACEHOLDER } from "@/content/placeholder";
import { CONFIGURABLE_PLAN_IDS, PLANS } from "@/content/plans";
import type { PlanId } from "@/content/plans";

export { PLACEHOLDER };
export const QUOTE = "Sur devis";

const priceText = z.string().trim().min(1).max(40);
const planPrices = z.strictObject({ monthly: priceText.optional(), yearly: priceText.optional() });
const pricesSchema = z.strictObject(Object.fromEntries(CONFIGURABLE_PLAN_IDS.map((id) => [id, planPrices.optional()])));

export type PriceConfig = Partial<Record<PlanId, { monthly?: string | undefined; yearly?: string | undefined }>>;

export function parsePriceConfig(raw: string | undefined): PriceConfig {
  if (raw === undefined || raw.trim() === "") return {};
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error("NEXT_PUBLIC_PLAN_PRICES n’est pas un JSON valide.");
  }
  const result = pricesSchema.safeParse(json);
  if (!result.success) throw new Error(`NEXT_PUBLIC_PLAN_PRICES est invalide : ${result.error.issues.map((issue) => issue.message).join(" ; ")}`);
  return result.data;
}

export interface PlanView {
  id: PlanId;
  name: string;
  description: string;
  highlight: boolean;
  cta: string;
  quote: boolean;
  monthly: string | null;
  yearly: string | null;
}

export function planViews(config: PriceConfig): PlanView[] {
  return PLANS.map((plan) => {
    const quote = plan.pricing === "quote";
    return {
      id: plan.id,
      name: plan.name,
      description: plan.description,
      highlight: plan.highlight,
      cta: plan.cta,
      quote,
      monthly: quote ? null : (config[plan.id]?.monthly ?? null),
      yearly: quote ? null : (config[plan.id]?.yearly ?? null),
    };
  });
}

export function hasConfiguredPrices(plans: readonly PlanView[]): boolean {
  return plans.some((plan) => plan.monthly !== null || plan.yearly !== null);
}
