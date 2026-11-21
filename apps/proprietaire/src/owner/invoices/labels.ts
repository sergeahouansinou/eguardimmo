import type { BadgeTone } from "@eguardimmo/ui";

export const INVOICE_KIND: Readonly<Record<string, string>> = { invoice: "Facture", credit_note: "Avoir" };

export const INVOICE_STATUS: Readonly<Record<string, { label: string; tone: BadgeTone }>> = {
  draft: { label: "Brouillon", tone: "neutral" },
  issued: { label: "Émise", tone: "info" },
  partially_paid: { label: "Partiellement réglée", tone: "warning" },
  paid: { label: "Réglée", tone: "success" },
  cancelled: { label: "Annulée", tone: "neutral" },
  discarded: { label: "Abandonnée", tone: "neutral" },
};

export const TAX_CATEGORY: Readonly<Record<string, string>> = {
  S: "Taux normal",
  Z: "Taux zéro",
  E: "Exonéré",
  AE: "Autoliquidation",
  O: "Hors champ",
};
