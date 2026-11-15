import type { BadgeTone } from "@eguardimmo/ui";
import type { Priority, Status } from "./schemas";

export const PRIORITY_LABELS: Record<Priority, string> = {
  urgente: "Urgente",
  normale: "Normale",
  basse: "Basse",
};

export const PRIORITY_TONES: Record<Priority, BadgeTone> = {
  urgente: "danger",
  normale: "warning",
  basse: "info",
};

export const STATUS_LABELS: Record<Status, string> = {
  ouverte: "Ouverte",
  en_cours: "En cours",
  devis_a_soumettre: "Devis à soumettre",
  devis_soumis: "Devis soumis",
  terminee: "Terminée",
  archivee: "Archivée",
};

export const STATUS_TONES: Record<Status, BadgeTone> = {
  ouverte: "neutral",
  en_cours: "warning",
  devis_a_soumettre: "warning",
  devis_soumis: "info",
  terminee: "success",
  archivee: "neutral",
};

export const PRIORITY_RANK: Record<Priority, number> = { urgente: 0, normale: 1, basse: 2 };
