import { describe, expect, it } from "vitest";
import { CURRENCIES, currencyName, parseAmount } from "@/lib/currency";
import type { Currency } from "@/lib/currency";
import { defaultsFormSchema } from "../reglages/defaultsSchema";
import { makeAvenantFormSchema } from "./forms";
import { mandatApiFormSchema } from "./mandats/apiForm";

const BACKEND_MAX_AMOUNT = 100_000_000_000;
const LARGEST_ACCEPTED: Readonly<Record<Currency, string>> = { EUR: "999 999 999,99", XOF: "999 999 999" };
const TOO_LARGE = ["1 000 000 000", "1 000 000 000,00", "100 000 000 000", "999999999999999999"];

const mandate = (currency: Currency, overrides = {}) => ({
  mandantId: "m",
  typeId: "t",
  units: [{ unitId: "u" }],
  currency,
  feeKind: "percentage" as const,
  feePercent: "7",
  flatFee: "",
  feeBase: "rent" as const,
  feeMinimum: "0",
  feeTaxMode: "excl_tax" as const,
  payoutDay: "5",
  worksLimit: "0",
  lettingRate: "",
  worksFeeRate: "",
  startIso: "2026-11-16",
  endIso: "2029-11-30",
  renewal: "aucune" as const,
  signedOn: "",
  ...overrides,
});

const defaults = (currency: Currency, overrides = {}) => ({
  currency,
  feeKind: "percentage" as const,
  feePercent: "7",
  flatFee: "",
  feeBase: "rent" as const,
  feeMinimum: "0",
  feeTaxMode: "excl_tax" as const,
  payoutDay: "5",
  worksLimit: "0",
  lettingRate: "",
  worksFeeRate: "",
  ...overrides,
});

const avenantContext = (currency: Currency) => ({ todayIso: "2026-11-16", endIsoByMandat: {}, currencyByMandat: { mandat: currency }, api: true });
const avenant = (overrides = {}) => ({
  mandatId: "mandat",
  kind: "honoraires" as const,
  effectIso: "2026-11-16",
  feePercent: "6",
  endIso: "",
  payoutDay: "5",
  worksLimit: "0",
  feeBase: "rent",
  feeMinimum: "0",
  feeTaxMode: "excl_tax",
  lettingRate: "",
  worksFeeRate: "",
  note: "",
  ...overrides,
});

const issueAt = (result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }, path: string): string | undefined =>
  result.error?.issues.find((issue) => issue.path[0] === path)?.message;

describe("plafond des montants : le formulaire refuse avant le serveur", () => {
  it.each(CURRENCIES)("le plus grand montant saisissable en %s reste sous le plafond du serveur", (currency) => {
    const minor = parseAmount(LARGEST_ACCEPTED[currency], currency);

    expect(minor).not.toBeNull();
    expect(minor ?? Infinity).toBeLessThan(BACKEND_MAX_AMOUNT);
    TOO_LARGE.forEach((text) => {
      expect(parseAmount(text, currency)).toBeNull();
    });
  });

  describe.each(CURRENCIES)("devise %s", (currency) => {
    const accepted = LARGEST_ACCEPTED[currency];

    it.each(["feeMinimum", "worksLimit"] as const)("création de mandat : %s au-delà du plafond est refusé en français, dans la devise", (field) => {
      TOO_LARGE.forEach((text) => {
        const message = issueAt(mandatApiFormSchema.safeParse(mandate(currency, { [field]: text })), field);
        expect(message).toContain(currencyName(currency));
      });
      expect(mandatApiFormSchema.safeParse(mandate(currency, { [field]: accepted })).success).toBe(true);
    });

    it("création de mandat : le forfait mensuel au-delà du plafond est refusé", () => {
      TOO_LARGE.forEach((text) => {
        const result = mandatApiFormSchema.safeParse(mandate(currency, { feeKind: "flat", feePercent: "", flatFee: text }));
        expect(issueAt(result, "flatFee")).toContain(currencyName(currency));
      });
      expect(mandatApiFormSchema.safeParse(mandate(currency, { feeKind: "flat", feePercent: "", flatFee: accepted })).success).toBe(true);
    });

    it.each(["feeMinimum", "worksLimit", "flatFee"] as const)("conditions par défaut : %s au-delà du plafond est refusé", (field) => {
      const flat = field === "flatFee" ? { feeKind: "flat", feePercent: "" } : {};
      TOO_LARGE.forEach((text) => {
        expect(issueAt(defaultsFormSchema.safeParse(defaults(currency, { ...flat, [field]: text })), field)).toContain(currencyName(currency));
      });
      expect(defaultsFormSchema.safeParse(defaults(currency, { ...flat, [field]: accepted })).success).toBe(true);
    });

    it("avenant : le minimum mensuel et le plafond de travaux au-delà du plafond sont refusés", () => {
      const schema = makeAvenantFormSchema(avenantContext(currency));
      TOO_LARGE.forEach((text) => {
        expect(issueAt(schema.safeParse(avenant({ feeMinimum: text })), "feeMinimum")).toContain(currencyName(currency));
        expect(issueAt(schema.safeParse(avenant({ kind: "travaux", worksLimit: text })), "worksLimit")).toContain(currencyName(currency));
      });
      expect(schema.safeParse(avenant({ feeMinimum: accepted })).success).toBe(true);
      expect(schema.safeParse(avenant({ kind: "travaux", worksLimit: accepted })).success).toBe(true);
    });
  });
});
