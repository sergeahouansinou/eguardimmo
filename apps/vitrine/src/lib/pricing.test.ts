import { describe, expect, it } from "vitest";
import { hasConfiguredPrices, parsePriceConfig, planViews, PLACEHOLDER, QUOTE } from "./pricing";

describe("tarifs de la vitrine", () => {
  it("sans configuration, aucun montant : champs à renseigner et « Sur devis » pour le réseau", () => {
    const plans = planViews(parsePriceConfig(undefined));
    expect(plans.map((plan) => plan.name)).toEqual(["Essentiel", "Agence", "Réseau"]);
    expect(plans.every((plan) => plan.monthly === null && plan.yearly === null)).toBe(true);
    expect(plans.find((plan) => plan.id === "reseau")?.quote).toBe(true);
    expect(hasConfiguredPrices(plans)).toBe(false);
    expect(PLACEHOLDER).toBe("[À RENSEIGNER]");
    expect(QUOTE).toBe("Sur devis");
  });

  it("applique les montants fournis par la configuration, plan par plan", () => {
    const config = parsePriceConfig('{"essentiel":{"monthly":"10 € HT"},"agence":{"monthly":"20 € HT","yearly":"200 € HT"}}');
    const plans = planViews(config);
    expect(plans[0]).toMatchObject({ monthly: "10 € HT", yearly: null });
    expect(plans[1]).toMatchObject({ monthly: "20 € HT", yearly: "200 € HT" });
    expect(hasConfiguredPrices(plans)).toBe(true);
  });

  it("ne laisse jamais la configuration fixer un prix au plan sur devis", () => {
    expect(() => parsePriceConfig('{"reseau":{"monthly":"1 €"}}')).toThrow(/invalide/);
  });

  it("échoue bruyamment sur un JSON illisible, une clé inconnue ou un montant vide", () => {
    expect(() => parsePriceConfig("{pas du json")).toThrow(/JSON valide/);
    expect(() => parsePriceConfig('{"essentiel":{"mensuel":"1 €"}}')).toThrow(/invalide/);
    expect(() => parsePriceConfig('{"essentiel":{"monthly":""}}')).toThrow(/invalide/);
    expect(() => parsePriceConfig('{"essentiel":{"monthly":12}}')).toThrow(/invalide/);
  });

  it("traite une valeur vide comme une absence de configuration", () => {
    expect(parsePriceConfig("   ")).toEqual({});
  });
});
