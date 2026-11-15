import type { BadgeTone } from "@eguardimmo/ui";
import type { ReportState } from "./schemas";

export const STATE_LABELS: Record<ReportState, string> = {
  a_generer: "À générer",
  brouillon: "Brouillon",
  genere: "Généré",
  publie: "Publié",
};

export const STATE_TONES: Record<ReportState, BadgeTone> = {
  a_generer: "neutral",
  brouillon: "warning",
  genere: "info",
  publie: "success",
};

export const ROW_ACTIONS: Record<ReportState, string> = {
  a_generer: "Générer",
  brouillon: "Reprendre",
  genere: "Ouvrir",
  publie: "Consulter",
};

export function apercuHref(id: string): string {
  return `/comptes-rendus/${id}/apercu`;
}

export function withPreposition(short: string): string {
  if (short.startsWith("du ")) return short;
  return /^[aeiouyàâéèêîôû]/i.test(short) ? `d'${short}` : `de ${short}`;
}
