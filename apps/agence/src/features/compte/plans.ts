export type PlanId = "gratuit" | "silver" | "gold";

export interface PlanDefinition {
  id: PlanId;
  name: string;
  monthlyMinor: number;
  yearlyMinor: number;
  lots: number | null;
  seats: number | null;
  storageMb: number;
  features: readonly string[];
}

export const TRIAL_DAYS = 15;

export const PLANS: readonly PlanDefinition[] = [
  {
    id: "gratuit",
    name: "Gratuit",
    monthlyMinor: 0,
    yearlyMinor: 0,
    lots: 1,
    seats: 1,
    storageMb: 50,
    features: ["1 lot", "1 collaborateur", "2 locataires, 2 baux, 4 états des lieux", "50 Mo de stockage"],
  },
  {
    id: "silver",
    name: "Silver",
    monthlyMinor: 490,
    yearlyMinor: 5800,
    lots: 5,
    seats: null,
    storageMb: 500,
    features: ["2 à 5 lots", "Plusieurs collaborateurs", "Locataires, baux et états des lieux illimités", "500 Mo de stockage", "10 signatures par mois"],
  },
  {
    id: "gold",
    name: "Gold",
    monthlyMinor: 1090,
    yearlyMinor: 11800,
    lots: null,
    seats: null,
    storageMb: 5000,
    features: ["Lots illimités", "Plusieurs collaborateurs", "Locataires, baux et états des lieux illimités", "5 Go de stockage", "20 signatures par mois"],
  },
];

export function planById(id: string): PlanDefinition | undefined {
  return PLANS.find((plan) => plan.id === id);
}
