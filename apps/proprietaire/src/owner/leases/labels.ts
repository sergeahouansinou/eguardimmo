import type { BadgeTone } from "@eguardimmo/ui";

export const LEASE_PHASE: Readonly<Record<string, { label: string; tone: BadgeTone }>> = {
  draft: { label: "En préparation", tone: "neutral" },
  upcoming: { label: "À venir", tone: "info" },
  running: { label: "En cours", tone: "success" },
  notice: { label: "Préavis en cours", tone: "warning" },
  ended: { label: "Terminé", tone: "neutral" },
};

export const PERIODICITY: Readonly<Record<string, string>> = {
  monthly: "Mensuelle",
  quarterly: "Trimestrielle",
  semiannual: "Semestrielle",
  annual: "Annuelle",
};

export const BILLING_TIMING: Readonly<Record<string, string>> = {
  advance: "À échoir (payé d’avance)",
  arrears: "À terme échu",
};

export const PARTY_ROLE: Readonly<Record<string, string>> = {
  tenant: "Locataire",
  guarantor: "Garant",
  occupant: "Occupant",
};

export const NOTICE_GIVEN_BY: Readonly<Record<string, string>> = {
  tenant: "le locataire",
  landlord: "le bailleur",
};
