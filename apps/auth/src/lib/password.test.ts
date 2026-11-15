import { describe, expect, it } from "vitest";
import { checkPassword, passwordStrength } from "./password";

describe("checkPassword", () => {
  it("signale les règles non respectées", () => {
    expect(checkPassword("court").map((check) => check.ok)).toEqual([false, false]);
    expect(checkPassword("motdepasselong").map((check) => check.ok)).toEqual([true, false]);
    expect(checkPassword("MotDePasse-2026").map((check) => check.ok)).toEqual([true, true]);
  });
});

describe("passwordStrength", () => {
  it.each([
    ["", "vide"],
    ["abc", "faible"],
    ["Abcdefghijkl", "moyen"],
    ["MotDePasse2026", "bon"],
    ["MotDePasse-2026-Long", "excellent"],
  ])("classe %j en %s", (value, level) => {
    expect(passwordStrength(value).level).toBe(level);
  });
});
