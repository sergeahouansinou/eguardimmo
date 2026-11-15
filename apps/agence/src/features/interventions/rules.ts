import type { ChangeableStatus, Status } from "./schemas";

export const TRANSITIONS: Record<Status, readonly ChangeableStatus[]> = {
  ouverte: ["en_cours", "terminee"],
  en_cours: ["terminee"],
  devis_a_soumettre: ["terminee"],
  devis_soumis: ["en_cours", "terminee"],
  terminee: ["archivee", "ouverte"],
  archivee: ["terminee"],
};

export const TRANSITION_EVENTS: Record<ChangeableStatus, { title: string; tone: "default" | "success" | "neutral" }> = {
  ouverte: { title: "Intervention rouverte", tone: "default" },
  en_cours: { title: "Intervention démarrée", tone: "default" },
  terminee: { title: "Intervention terminée", tone: "success" },
  archivee: { title: "Intervention archivée", tone: "neutral" },
};
