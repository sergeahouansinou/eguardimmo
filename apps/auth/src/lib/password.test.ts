import { describe, expect, it } from "vitest";
import { PASSWORD_MIN_LENGTH, PASSWORD_PLACEHOLDER, passwordLength, passwordStrength } from "./password";

describe("longueur du mot de passe", () => {
  it("exige 6 caractères, comme le serveur", () => {
    expect(PASSWORD_MIN_LENGTH).toBe(6);
    expect(PASSWORD_PLACEHOLDER).toBe("6 caractères minimum");
  });

  it("compte les caractères Unicode comme le serveur", () => {
    expect(passwordLength("Éé-1Éé")).toBe(6);
    expect(passwordLength("😀😀😀")).toBe(3);
  });
});

describe("passwordStrength", () => {
  it.each([
    ["", "vide"],
    ["abc", "faible"],
    ["azerty", "faible"],
    ["Abcdefghijkl", "moyen"],
    ["MotDePasse-2026", "bon"],
    ["MotDePasse-2026-Long", "excellent"],
  ])("classe %j en %s", (value, level) => {
    expect(passwordStrength(value).level).toBe(level);
  });
});
