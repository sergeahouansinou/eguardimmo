import type { BadgeTone } from "@eguardimmo/ui";

export const MANDATE_STATUS: Readonly<Record<string, { label: string; tone: BadgeTone }>> = {
  draft: { label: "En préparation", tone: "neutral" },
  active: { label: "En cours", tone: "success" },
  suspended: { label: "Suspendu", tone: "warning" },
  terminated: { label: "Résilié", tone: "neutral" },
  expired: { label: "Arrivé à échéance", tone: "neutral" },
};

export const FEE_BASE: Readonly<Record<string, string>> = {
  rent: "du loyer hors charges",
  rent_and_charges: "du loyer charges comprises",
};

export const FEE_TAX: Readonly<Record<string, string>> = { excl_tax: "hors taxes", incl_tax: "toutes taxes comprises" };

export const END_REQUEST_NOTICE =
  "L’agence est informée de votre demande. La résiliation n’est effective qu’après traitement par l’agence ; le mandat et la gestion se poursuivent normalement d’ici là.";
