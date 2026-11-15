import type { BadgeTone } from "@eguardimmo/ui";
import { bailSituation, overdueDays } from "./selectors";
import type { MandatState } from "./selectors";
import type { Bail, BailStatus, MandantType, PaymentMode } from "./schemas";

export interface Pill {
  tone: BadgeTone;
  label: string;
}

export const MANDAT_STATE_PILLS: Record<MandatState, Pill> = {
  actif: { tone: "success", label: "Actif" },
  a_renouveler: { tone: "warning", label: "À renouveler" },
  resilie: { tone: "warning", label: "Fin programmée" },
  termine: { tone: "neutral", label: "Terminé" },
  brouillon: { tone: "neutral", label: "Brouillon" },
};

export const MANDANT_TYPE_LABELS: Record<MandantType, string> = {
  particulier: "Particulier",
  societe: "Société civile",
  indivision: "Indivision",
};

export const PAYMENT_MODE_LABELS: Record<PaymentMode, string> = {
  virement: "Virement",
  prelevement: "Prélèvement",
  cheque: "Chèque",
};

export const BAIL_STATUS_PILLS: Record<BailStatus, Pill> = {
  en_cours: { tone: "success", label: "En cours" },
  a_venir: { tone: "info", label: "À venir" },
  termine: { tone: "neutral", label: "Terminé" },
  brouillon: { tone: "neutral", label: "Brouillon" },
};

function days(count: number): string {
  return `${String(count)} ${count > 1 ? "jours" : "jour"}`;
}

export function bienPill(bail: Bail | undefined, todayIso: string): Pill {
  if (!bail) return { tone: "neutral", label: "Vacant" };
  const situation = bailSituation(bail);
  if (situation === "impaye") return { tone: "danger", label: `Impayé, ${days(overdueDays(bail, todayIso))}` };
  return situation === "preavis" ? { tone: "warning", label: "Préavis donné" } : { tone: "success", label: "Payé" };
}

export function locatairePill(bail: Bail | undefined, todayIso: string): Pill {
  if (!bail) return { tone: "neutral", label: "Sans bail en cours" };
  const situation = bailSituation(bail);
  if (situation === "impaye") return { tone: "danger", label: `Impayé, ${days(overdueDays(bail, todayIso))}` };
  return situation === "preavis" ? { tone: "warning", label: "Préavis donné" } : { tone: "success", label: "À jour" };
}

export function bailPill(bail: Bail): Pill {
  if (bail.status !== "en_cours") return BAIL_STATUS_PILLS[bail.status];
  const situation = bailSituation(bail);
  if (situation === "impaye") return { tone: "danger", label: "Loyer en retard" };
  return situation === "preavis" ? { tone: "warning", label: "Préavis donné" } : BAIL_STATUS_PILLS.en_cours;
}

export function bailKindLabel(bail: Bail): string {
  return bail.furnished ? "Meublé" : "Vide";
}

export function plural(count: number, one: string, many: string): string {
  return `${String(count)} ${count > 1 ? many : one}`;
}
