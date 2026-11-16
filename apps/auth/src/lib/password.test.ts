import { describe, expect, it } from "vitest";
import { checkPassword, passwordStrength } from "./password";

describe("checkPassword", () => {
  it("signale les règles non respectées", () => {
    expect(checkPassword("court").map((check) => check.ok)).toEqual([false, false, false, false]);
    expect(checkPassword("motdepasselong").map((check) => check.ok)).toEqual([true, false, false, false]);
    expect(checkPassword("MotDePasse2026").map((check) => check.ok)).toEqual([true, true, true, false]);
    expect(checkPassword("MotDePasse-2026").map((check) => check.ok)).toEqual([true, true, true, true]);
  });

  it("exige une majuscule ET une minuscule, comme le serveur", () => {
    expect(checkPassword("MOTDEPASSE-2026").find((check) => check.id === "case")?.ok).toBe(false);
    expect(checkPassword("motdepasse-2026").find((check) => check.id === "case")?.ok).toBe(false);
  });

  it("compte les caractères Unicode comme le serveur", () => {
    expect(checkPassword("Éé-1Éé-1Éé-1").find((check) => check.id === "length")?.ok).toBe(true);
    expect(checkPassword("😀😀😀😀😀😀😀😀😀😀😀").find((check) => check.id === "length")?.ok).toBe(false);
    expect(checkPassword("😀😀😀😀😀😀😀😀😀😀😀😀").find((check) => check.id === "length")?.ok).toBe(true);
  });
});

describe("passwordStrength", () => {
  it.each([
    ["", "vide"],
    ["abc", "faible"],
    ["Abcdefghijkl", "moyen"],
    ["MotDePasse-2026", "bon"],
    ["MotDePasse-2026-Long", "excellent"],
  ])("classe %j en %s", (value, level) => {
    expect(passwordStrength(value).level).toBe(level);
  });
});
