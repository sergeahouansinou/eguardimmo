import { describe, expect, it } from "vitest";
import { toTermDefaults } from "./api/apiDefaults";
import type { TermDefaultsInput } from "./api/apiDefaults";
import { apiTermDefaultsSchema } from "./api/apiDefaults";
import { termDefaultsJson } from "./api/testing";
import { optionalRate } from "./feeTerms";
import { defaultsToFormValues, toTermDefaultsInput } from "./termsForm";

const parse = (overrides = {}) => toTermDefaults(apiTermDefaultsSchema.parse(termDefaultsJson(overrides)));

describe("conditions par défaut et formulaire", () => {
  it("fait l'aller-retour serveur → formulaire → payload sans perdre ni inventer une valeur", () => {
    const values = defaultsToFormValues(parse());

    const input = toTermDefaultsInput(values);

    const expected: TermDefaultsInput = {
      feeKind: "percentage",
      feeBasisPoints: 650,
      feeBase: "rent_and_charges",
      feeMinimumMinor: 1_500,
      feeTaxMode: "excl_tax",
      payoutDay: 7,
      worksLimitMinor: 60_000,
      lettingFeeBasisPoints: 5_000,
      worksFeeBasisPoints: null,
    };
    expect(input).toEqual(expected);
  });

  it("garde les montants en FCFA tels quels, sans décimales ni multiplication par 100", () => {
    const defaults = parse({ currency: "XOF", fee_minimum_amount: { amount: 5_000, currency: "XOF" }, works_limit_amount: { amount: 250_000, currency: "XOF" } });

    const input = toTermDefaultsInput(defaultsToFormValues(defaults));

    expect(input.feeMinimumMinor).toBe(5_000);
    expect(input.worksLimitMinor).toBe(250_000);
  });

  it("porte un forfait mensuel sans taux", () => {
    const flat = parse({ fee_kind: "flat", fee_basis_points: null, fee_flat_amount: { amount: 4_500, currency: "EUR" } });

    const input = toTermDefaultsInput(defaultsToFormValues(flat));

    expect(input).toMatchObject({ feeKind: "flat", flatFeeMinor: 4_500 });
    expect(input).not.toHaveProperty("feeBasisPoints");
  });

  it("refuse des montants de devises différentes dans une même réponse", () => {
    expect(() => parse({ works_limit_amount: { amount: 1, currency: "XOF" } })).toThrow();
  });

  it.each([
    ["", null],
    ["  ", null],
    ["50", 5_000],
    ["5,5", 550],
    ["100", 10_000],
    ["100,01", undefined],
    ["abc", undefined],
  ])("taux facultatif « %s » : %s", (text, expected) => {
    expect(optionalRate(text)).toBe(expected);
  });
});
