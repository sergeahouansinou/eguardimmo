import type { Amenity, Category, Kind, Policy, PriceUnit, Status } from "./schemas";

export const KIND_LABELS: Readonly<Record<Kind, string>> = { short_stay: "Courte durée", long_term: "Longue durée" };

export const PRICE_UNIT_LABELS: Readonly<Record<PriceUnit, string>> = { night: "par nuit", month: "par mois" };

export const KIND_PRICE_UNIT: Readonly<Record<Kind, PriceUnit>> = { short_stay: "night", long_term: "month" };

export const CATEGORY_LABELS: Readonly<Record<Category, string>> = { studio: "Studio", apartment: "Appartement", house: "Maison", shared: "Colocation" };

export const STATUS_LABELS: Readonly<Record<Status, string>> = { draft: "Brouillon", published: "Publiée", archived: "Archivée" };

export const STATUS_TONES: Readonly<Record<Status, "neutral" | "success" | "warning">> = { draft: "neutral", published: "success", archived: "warning" };

export const POLICY_LABELS: Readonly<Record<Policy, string>> = {
  flexible: "Flexible",
  moderate: "Modérée",
  strict: "Stricte",
};

export const AMENITY_LABELS: Readonly<Record<Amenity, string>> = {
  wifi: "Wi-Fi",
  kitchen: "Cuisine équipée",
  washer: "Lave-linge",
  dishwasher: "Lave-vaisselle",
  air_conditioning: "Climatisation",
  heating: "Chauffage",
  parking: "Parking",
  elevator: "Ascenseur",
  balcony: "Balcon",
  terrace: "Terrasse",
  garden: "Jardin",
  pool: "Piscine",
  tv: "Télévision",
  workspace: "Espace de travail",
  pets_allowed: "Animaux acceptés",
  step_free_access: "Accès sans marche",
};

export const MISSING_LABELS: Readonly<Record<string, string>> = {
  title: "le titre",
  price_minor: "le prix",
  city_id: "la ville",
  capacity: "la capacité d’accueil",
};

export function missingLabels(missing: readonly string[]): string {
  return missing.map((key) => MISSING_LABELS[key] ?? key).join(", ");
}
