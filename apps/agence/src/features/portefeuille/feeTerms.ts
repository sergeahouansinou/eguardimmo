import { parseRateBasisPoints } from "@/lib/currency";
import type { ApiFeeBase, ApiFeeTaxMode } from "./api/apiSchemas";

export const FEE_BASE_LABELS: Readonly<Record<ApiFeeBase, string>> = {
  rent: "Loyer hors charges",
  rent_and_charges: "Loyer et charges",
};

export const FEE_TAX_MODE_LABELS: Readonly<Record<ApiFeeTaxMode, string>> = {
  excl_tax: "Hors taxes (la taxe s'ajoute)",
  incl_tax: "Toutes taxes comprises",
};

export const FEE_BASE_OPTIONS = Object.entries(FEE_BASE_LABELS).map(([value, label]) => ({ value, label }));
export const FEE_TAX_MODE_OPTIONS = Object.entries(FEE_TAX_MODE_LABELS).map(([value, label]) => ({ value, label }));

const MAX_RATE_BASIS_POINTS = 10_000;

export const OPTIONAL_RATE_MESSAGE = "Saisissez un taux entre 0 et 100 %, par exemple 50, ou laissez vide si le mandat ne le prévoit pas.";

export function optionalRate(text: string): number | null | undefined {
  if (text.trim() === "") return null;
  const rate = parseRateBasisPoints(text);
  return rate === null || rate > MAX_RATE_BASIS_POINTS ? undefined : rate;
}
