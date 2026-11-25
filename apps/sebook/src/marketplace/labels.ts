import type { BOOKING_STATUSES, CancellationPolicy, Category, Kind, Sort } from "./schemas";

export const KIND_LABELS: Record<Kind, string> = { short_stay: "Séjours", long_term: "Longue durée" };

export const CATEGORY_LABELS: Record<Category, string> = {
  studio: "Studios",
  apartment: "Appartements",
  house: "Maisons",
  shared: "Colocations",
};

export const CATEGORY_SINGULAR: Record<Category, string> = {
  studio: "Studio",
  apartment: "Appartement",
  house: "Maison",
  shared: "Colocation",
};

export const SORT_LABELS: Record<Sort, string> = {
  relevance: "Pertinence",
  price_asc: "Prix croissant",
  price_desc: "Prix décroissant",
  recent: "Plus récentes",
};

export const AMENITY_LABELS: Readonly<Record<string, string>> = {
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
  step_free_access: "Accès sans marches",
};

export function amenityLabel(id: string): string {
  return AMENITY_LABELS[id] ?? id.replace(/_/g, " ");
}

export const POLICY_LABELS: Record<CancellationPolicy, { name: string; text: string }> = {
  flexible: { name: "Flexible", text: "Remboursement intégral jusqu’à 1 jour avant l’arrivée." },
  moderate: { name: "Modérée", text: "Remboursement intégral jusqu’à 5 jours avant l’arrivée." },
  strict: { name: "Stricte", text: "Remboursement de 50 % jusqu’à 7 jours avant l’arrivée." },
};

export const PRICE_UNIT_LABELS = { night: "par nuit", month: "par mois" } as const;

export const BOOKING_STATUS_LABELS: Record<(typeof BOOKING_STATUSES)[number], { label: string; tone: "warning" | "success" | "danger" | "neutral" }> = {
  pending_payment: { label: "Paiement à finaliser", tone: "warning" },
  confirmed: { label: "Confirmée", tone: "success" },
  cancelled: { label: "Annulée", tone: "danger" },
  completed: { label: "Terminée", tone: "neutral" },
};

export function guestsLabel(count: number): string {
  return `${String(count)} voyageur${count > 1 ? "s" : ""}`;
}

export const BOOKING_OUTCOMES: Record<(typeof BOOKING_STATUSES)[number], { title: string; tone: "warning" | "success" | "danger" | "info"; text: string }> = {
  pending_payment: {
    title: "Paiement à finaliser",
    tone: "warning",
    text: "Votre réservation est enregistrée mais elle n’est pas confirmée tant que le paiement n’est pas finalisé. Sans paiement, les dates sont libérées au bout de 30 minutes.",
  },
  confirmed: { title: "Réservation confirmée", tone: "success", text: "Votre réservation est confirmée." },
  cancelled: { title: "Réservation annulée", tone: "danger", text: "Cette réservation est annulée." },
  completed: { title: "Séjour terminé", tone: "info", text: "Ce séjour est terminé." },
};
