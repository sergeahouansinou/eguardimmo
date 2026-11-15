import { describe, expect, it } from "vitest";
import { excludingVatRate, formatPercent, formatSiren, isValidFrenchIban, isValidSiren, maskIban, parseRateBp, payoutDayLabel, rateBpToText } from "./logic";

describe("réglages : contrôles", () => {
  it("valide le SIREN par sa clé de contrôle", () => {
    expect(isValidSiren("912 345 675")).toBe(true);
    expect(isValidSiren("912345678")).toBe(false);
    expect(isValidSiren("91234567")).toBe(false);
    expect(isValidSiren("91234567A")).toBe(false);
    expect(formatSiren("912345675")).toBe("912 345 675");
  });

  it("valide un IBAN français par sa clé mod 97 et n’en garde que la version masquée", () => {
    expect(isValidFrenchIban("FR76 3000 6000 0112 3456 7890 189")).toBe(true);
    expect(isValidFrenchIban("fr7630006000011234567890189")).toBe(true);
    expect(isValidFrenchIban("FR76 3000 6000 0112 3456 7890 188")).toBe(false);
    expect(isValidFrenchIban("DE89 3704 0044 0532 0130 00")).toBe(false);
    expect(maskIban("FR76 3000 6000 0112 3456 7890 189")).toEqual({ masked: "FR76 •••• •••• •••• •••• 0189", last4: "0189" });
  });

  it("convertit les taux en points de base sans flottant", () => {
    expect(parseRateBp("7")).toBe(700);
    expect(parseRateBp("7,5 %")).toBe(750);
    expect(parseRateBp("5.83")).toBe(583);
    expect(parseRateBp("abc")).toBeNull();
    expect(parseRateBp("100")).toBeNull();
    expect(rateBpToText(700)).toBe("7");
    expect(rateBpToText(750)).toBe("7,5");
  });

  it("calcule l’équivalent hors taxe", () => {
    expect(excludingVatRate(700, 2000)).toBe(583);
    expect(formatPercent(583)).toBe("5,83 %");
    expect(formatPercent(700)).toBe("7 %");
    expect(excludingVatRate(800, 2000)).toBe(667);
    expect(excludingVatRate(700, 0)).toBe(700);
  });

  it("libelle le jour de reversement", () => {
    expect(payoutDayLabel(5)).toBe("Le 5 du mois");
    expect(payoutDayLabel(1)).toBe("Le 1er du mois");
  });
});
