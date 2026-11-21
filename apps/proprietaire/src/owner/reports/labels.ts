import type { BadgeTone } from "@eguardimmo/ui";

export const REPORT_STATUS: Readonly<Record<string, { label: string; tone: BadgeTone }>> = {
  published: { label: "Publié", tone: "success" },
  superseded: { label: "Remplacé", tone: "neutral" },
};

export const PERIOD_KIND: Readonly<Record<string, string>> = {
  monthly: "Mensuel",
  quarterly: "Trimestriel",
  custom: "Période libre",
};

export const LINE_KIND: Readonly<Record<string, string>> = {
  rent_called: "Loyer appelé",
  rent_collected: "Loyer encaissé",
  advance: "Avance de loyer",
  fee: "Honoraires",
  fee_vat: "TVA sur honoraires",
  works: "Travaux",
  payout: "Reversement",
  adjustment: "Ajustement",
  arrears: "Impayé",
};

export const LINE_DIRECTION: Readonly<Record<string, string>> = { credit: "Crédit", debit: "Débit" };

export const SECTION_LABELS: Readonly<Record<string, string>> = {
  rent: "Loyers",
  fees: "Honoraires",
  payout: "Reversement",
  arrears: "Impayés",
  works: "Travaux",
  receipts: "Quittances",
};
