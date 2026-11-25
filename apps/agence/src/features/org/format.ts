import { currencyOf, formatCurrency } from "@/lib/currency";
import type { Money } from "./schemas";

export function formatMoney(money: Money, options: { signed?: boolean } = {}): string {
  const currency = currencyOf(money.currency);
  if (currency !== undefined) return formatCurrency(money.amount, currency, { fixed: true, signed: options.signed === true });
  if (!Number.isSafeInteger(money.amount)) throw new RangeError(`Montant en unités mineures non entier : ${String(money.amount)}`);
  const format = new Intl.NumberFormat("fr-FR", { style: "currency", currency: money.currency, signDisplay: options.signed === true ? "exceptZero" : "auto" });
  const digits = format.resolvedOptions().maximumFractionDigits ?? 2;
  return format.format(money.amount / 10 ** digits).replace(/[  ]/g, " ");
}
