import { describe, expect, it } from "vitest";
import { DEMO_TODAY } from "@/features/shared/dates";
import { baremeFormSchema, toBaremeInput } from "./baremeForm";
import type { BaremeFormInput } from "./baremeForm";

const valid: BaremeFormInput = {
  mandateId: "M-2025-0142",
  rate: "7,00",
  base: "rent",
  minFee: "0",
  letting: "50",
  works: "5,00",
  effectiveFrom: DEMO_TODAY,
};

describe("formulaire de barème", () => {
  it("accepte un barème valide et le convertit en points de base entiers", () => {
    expect(baremeFormSchema.safeParse(valid).success).toBe(true);
    expect(toBaremeInput(valid)).toEqual({ mandateId: "M-2025-0142", rateBp: 700, base: "rent", minFeeMinor: 0, lettingBp: 5000, worksBp: 500, effectiveFrom: DEMO_TODAY });
  });

  it("lit les pourcentages sans erreur de flottant", () => {
    expect(toBaremeInput({ ...valid, letting: "0,29", works: "1,15", rate: "6,55" })).toMatchObject({ lettingBp: 29, worksBp: 115, rateBp: 655 });
    expect(toBaremeInput({ ...valid, letting: "100" })).toMatchObject({ lettingBp: 10_000 });
  });

  it("refuse les valeurs hors bornes ou mal formées", () => {
    ["0", "25,01", "abc", "7,555"].forEach((rate) => {
      expect(baremeFormSchema.safeParse({ ...valid, rate }).success).toBe(false);
    });
    expect(baremeFormSchema.safeParse({ ...valid, letting: "100,01" }).success).toBe(false);
    expect(baremeFormSchema.safeParse({ ...valid, works: "15,01" }).success).toBe(false);
    expect(baremeFormSchema.safeParse({ ...valid, mandateId: "" }).success).toBe(false);
    expect(toBaremeInput({ ...valid, letting: "x" })).toBeNull();
  });

  it("refuse une entrée en vigueur passée", () => {
    expect(baremeFormSchema.safeParse({ ...valid, effectiveFrom: "2026-11-01" }).success).toBe(false);
  });

  it("n'expose plus de base « encaissés »", () => {
    expect(baremeFormSchema.safeParse({ ...valid, base: "encaisses" }).success).toBe(false);
  });
});
