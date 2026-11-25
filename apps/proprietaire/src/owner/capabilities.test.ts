import { describe, expect, it } from "vitest";
import { API_SERVED_ROUTES, pageFiles } from "../../test/pages";
import { GATED_FAMILIES, classifyRoute, familyHasApiSource, familyLabel, unavailableFamilyOf } from "./capabilities";

describe("table des familles sans source API de l'espace propriétaire", () => {
  it.each([
    ["/confie/fiscalite/declaration-2044", "fiscalite"],
    ["/confie/fiscalite/declaration-2044/", "fiscalite"],
    ["/confie/fiscalite/0193a5e1/extra", "fiscalite"],
    ["/confie/agence/mandat/autre", "mandat"],
    ["/confie/agence/inconnu", "mandat"],
    ["/confie/messages/12/extra", "messages"],
    ["/confie/messages/nouveau/extra", "messages"],
    ["/confie/aide/extra", "aide"],
    ["/confie/releve/extra", "autre"],
    ["/confie/annonces/12/extra", "autre"],
    ["/confie/support/12/extra", "autre"],
    ["/confie/support/nouvelle/extra", "autre"],
  ] as const)("%s est indisponible (%s) en mode api", (path, family) => {
    expect(unavailableFamilyOf(path)).toBe(family);
  });

  it.each(["/confie", "/confie/", "/confie?x=1", "/confie/agence", "/confie/agence/", "/confie/agence?x=1", "/confie/agence/mandat", "/confie/agence/mandat/", "/confie/agence/mandat/fin", "/confie/compte-de-paiement", "/confie/notifications", "/confie/notifications/toutes", "/confie/biens", "/confie/biens/0193a5e1", "/confie/biens?agency=1", "/confie/baux", "/confie/baux/0193a5e1", "/confie/loyers", "/confie/loyers/2026-10", "/confie/releve", "/confie/releve/", "/confie/releve?agency=1", "/confie/charges", "/confie/charges/0193a5e1", "/confie/charges?agency=1", "/confie/comptes-rendus", "/confie/comptes-rendus/0193a5e1", "/confie/documents", "/confie/factures", "/confie/factures/0193a5e1", "/confie/interventions", "/confie/interventions/0193a5e1", "/confie/messages", "/confie/messages/", "/confie/messages/nouveau", "/confie/messages/0193a5e1", "/confie/annonces", "/confie/annonces/", "/confie/annonces/0193a5e1", "/confie/support", "/confie/support/", "/confie/support/nouvelle", "/confie/support/0193a5e1", "/confie/aide", "/confie/aide/", "/confie/informations", "/confie/informations/modifier", "/confie/securite", "/confie/interventions/0193a5e1/devis", "/confie/interventions/0193a5e1/devis/", "/confie/comptes-rendus/0193a5e1/apercu", "/confie/fiscalite", "/confie/fiscalite/", "/confie/fiscalite?agency=1", "/confie/fiscalite/0193a5e1"])("%s reste servi (écran réel)", (path) => {
    expect(unavailableFamilyOf(path)).toBeNull();
  });

  it("refuse par défaut une route qu'aucune règle ne classe", () => {
    expect(classifyRoute("/confie/nouvelle-famille")).toBeNull();
    expect(unavailableFamilyOf("/confie/nouvelle-famille")).toBe("autre");
  });

  it("ne confond pas un préfixe de segment", () => {
    expect(classifyRoute("/confie/biens-x")).toBeNull();
    expect(classifyRoute("/confie/baux-x")).toBeNull();
    expect(classifyRoute("/confie/factures-x")).toBeNull();
    expect(classifyRoute("/confie/charges-x")).toBeNull();
    expect(classifyRoute("/confie/agence-x")).toBeNull();
  });

  it("nomme et classe chaque famille", () => {
    expect(Object.keys(familyHasApiSource).sort()).toEqual([...GATED_FAMILIES].sort());
    expect(Object.keys(familyLabel).sort()).toEqual([...GATED_FAMILIES].sort());
    for (const label of Object.values(familyLabel)) expect(label.trim()).not.toBe("");
  });

  it("classe chaque page de l'espace dans une famille gatée ou parmi les écrans réels", () => {
    const pages = pageFiles();

    expect(pages.length).toBeGreaterThan(20);
    expect(pages.filter((page) => classifyRoute(page.route) === null).map((page) => page.route)).toEqual([]);
  });

  it("ne sert en api que les écrans reliés au serveur", () => {
    const served = pageFiles()
      .filter((page) => unavailableFamilyOf(page.route) === null)
      .map((page) => page.route)
      .sort();

    expect(served).toEqual([...API_SERVED_ROUTES].sort());
  });
});
