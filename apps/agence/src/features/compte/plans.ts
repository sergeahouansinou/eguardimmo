export type PlanId = "agence" | "agence-pro" | "reseau";

export interface PlanDefinition {
  id: PlanId;
  name: string;
  monthlyMinor: number | null;
  lots: number | null;
  seats: number | null;
  storageMb: number | null;
  features: readonly string[];
}

export const YEARLY_BILLED_MONTHS = 10;

export const PLANS: readonly PlanDefinition[] = [
  {
    id: "agence",
    name: "Agence",
    monthlyMinor: 3900,
    lots: 20,
    seats: 5,
    storageMb: 5000,
    features: ["Comptes rendus", "Reversements"],
  },
  {
    id: "agence-pro",
    name: "Agence Pro",
    monthlyMinor: 7900,
    lots: 100,
    seats: 15,
    storageMb: 20000,
    features: ["Export comptable", "Support prioritaire"],
  },
  {
    id: "reseau",
    name: "Réseau",
    monthlyMinor: null,
    lots: null,
    seats: null,
    storageMb: null,
    features: ["Plusieurs agences", "Support dédié"],
  },
];

export function planById(id: string): PlanDefinition | undefined {
  return PLANS.find((plan) => plan.id === id);
}
