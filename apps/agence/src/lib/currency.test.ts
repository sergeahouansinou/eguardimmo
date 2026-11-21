import { describe, expect, it } from "vitest";
import { currencyDigits, currencyOf, formatAmountInput, formatCurrency, formatRateInput, parseAmount, parseRateBasisPoints } from "./currency";

const NBSP = " ";

describe("devises", () => {
  it("expose l'exposant de chaque devise", () => {
    expect(currencyDigits("EUR")).toBe(2);
    expect(currencyDigits("XOF")).toBe(0);
    expect(currencyOf("XOF")).toBe("XOF");
    expect(currencyOf("USD")).toBeUndefined();
  });

  it("lit un montant en euros en centimes, sans flottant", () => {
    expect(parseAmount("450", "EUR")).toBe(45_000);
    expect(parseAmount("450,5", "EUR")).toBe(45_050);
    expect(parseAmount("1 450,05", "EUR")).toBe(145_005);
    expect(parseAmount("0,29", "EUR")).toBe(29);
    expect(parseAmount("1.15", "EUR")).toBe(115);
    expect(parseAmount("12,345", "EUR")).toBeNull();
  });

  it("lit un montant en FCFA sans décimales", () => {
    expect(parseAmount("250 000", "XOF")).toBe(250_000);
    expect(parseAmount("250000", "XOF")).toBe(250_000);
    expect(parseAmount("250 000,5", "XOF")).toBeNull();
    expect(parseAmount("250.0", "XOF")).toBeNull();
  });

  it("refuse les saisies invalides", () => {
    ["", "abc", "-5", "12.", ",5", "1,2,3", "1234567890"].forEach((text) => {
      expect(parseAmount(text, "EUR")).toBeNull();
    });
  });

  it("lit un pourcentage en points de base entiers", () => {
    expect(parseRateBasisPoints("7,00")).toBe(700);
    expect(parseRateBasisPoints("6,5 %")).toBe(650);
    expect(parseRateBasisPoints("0,29")).toBe(29);
    expect(parseRateBasisPoints("1.15")).toBe(115);
    expect(parseRateBasisPoints("100")).toBe(10_000);
    expect(parseRateBasisPoints("6,555")).toBeNull();
    expect(parseRateBasisPoints("1000")).toBeNull();
    expect(parseRateBasisPoints("abc")).toBeNull();
  });

  it("reformate un montant pour un champ de saisie", () => {
    expect(formatAmountInput(62_000, "EUR")).toBe("620");
    expect(formatAmountInput(62_050, "EUR")).toBe("620,50");
    expect(formatAmountInput(62_005, "EUR")).toBe("620,05");
    expect(formatAmountInput(250_000, "XOF")).toBe("250000");
    expect(formatRateInput(650)).toBe("6,50");
    expect(formatRateInput(700)).toBe("7");
    expect(parseAmount(formatAmountInput(62_005, "EUR"), "EUR")).toBe(62_005);
  });

  it("affiche chaque devise avec son exposant", () => {
    expect(formatCurrency(45_000, "EUR")).toBe(`450${NBSP}€`);
    expect(formatCurrency(45_050, "EUR")).toBe(`450,50${NBSP}€`);
    expect(formatCurrency(45_000, "EUR", { fixed: true })).toBe(`450,00${NBSP}€`);
    expect(formatCurrency(250_000, "XOF")).toBe(`250${NBSP}000${NBSP}F${NBSP}CFA`);
    expect(formatCurrency(250_000, "XOF", { fixed: true })).toBe(`250${NBSP}000${NBSP}F${NBSP}CFA`);
    expect(() => formatCurrency(10.5, "XOF")).toThrow(RangeError);
  });
});
