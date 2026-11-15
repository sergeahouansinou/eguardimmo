import type { PaymentMode } from "./model";

export interface SeedPayment {
  lotId: string;
  receivedOn: string;
  mode: PaymentMode;
  status: "recu" | "a_rapprocher";
}

export const NOVEMBER_PAYMENTS: readonly SeedPayment[] = [
  { lotId: "lot-4", receivedOn: "2026-11-10", mode: "virement", status: "recu" },
  { lotId: "apt-5", receivedOn: "2026-11-06", mode: "cheque", status: "a_rapprocher" },
  { lotId: "apt-9", receivedOn: "2026-11-05", mode: "virement", status: "recu" },
  { lotId: "apt-2", receivedOn: "2026-11-05", mode: "virement", status: "recu" },
  { lotId: "maison-les-pins", receivedOn: "2026-11-04", mode: "prelevement", status: "recu" },
  { lotId: "apt-6", receivedOn: "2026-11-04", mode: "prelevement", status: "recu" },
  { lotId: "apt-12", receivedOn: "2026-11-03", mode: "virement", status: "recu" },
  { lotId: "lot-1", receivedOn: "2026-11-03", mode: "virement", status: "recu" },
  { lotId: "apt-3", receivedOn: "2026-11-02", mode: "prelevement", status: "recu" },
  { lotId: "lot-2", receivedOn: "2026-11-02", mode: "prelevement", status: "recu" },
  { lotId: "maison-de-ville", receivedOn: "2026-11-02", mode: "virement", status: "recu" },
];

export const NOVEMBER_DUE_DATES: Readonly<Record<string, string>> = {
  "studio-4": "2026-11-01",
  "apt-7": "2026-10-19",
  "lot-3": "2026-11-05",
};

export const HISTORY_MONTHS: Readonly<Record<string, number>> = {
  "marc-chevalier": 14,
};
export const DEFAULT_HISTORY_MONTHS = 3;
