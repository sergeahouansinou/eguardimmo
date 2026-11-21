import type { BadgeTone } from "@eguardimmo/ui";
import type { Money } from "../shared/model";

export const STATEMENT_STATUS: Readonly<Record<string, { label: string; tone: BadgeTone }>> = {
  issued: { label: "Émis", tone: "info" },
  superseded: { label: "Remplacé par un rectificatif", tone: "neutral" },
};

export type BalanceKind = "due" | "refund" | "settled";

export interface BalanceReading {
  kind: BalanceKind;
  label: string;
  amount: Money;
}

// Le solde est celui du locataire : positif, il doit ; négatif, on lui rend. Son effet sur le compte du mandant n'est pas affirmé ici.
export function readBalance(balance: Money): BalanceReading {
  if (balance.amount > 0) return { kind: "due", label: "À payer par le locataire", amount: balance };
  if (balance.amount < 0) return { kind: "refund", label: "À rendre au locataire", amount: { amount: -balance.amount, currency: balance.currency } };
  return { kind: "settled", label: "Soldé", amount: balance };
}
