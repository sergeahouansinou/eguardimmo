import { describe, expect, it } from "vitest";
import { pageFiles } from "../../test/pages";
import { GATED_FAMILIES, classifyRoute, familyHasApiSource, familyLabel, familyNote, unavailableFamilyOf } from "./capabilities";

describe("table des familles sans source API de la console", () => {
  it.each([
    ["/organisations/nouvelle", "organisations-creation"],
    ["/abonnements/plans/nouveau", "abonnements-creation"],
    ["/sante/incidents", "sante-incidents"],
    ["/sante/incidents/12", "sante-incidents"],
    ["/sauvegardes/restauration", "sauvegardes-restauration"],
    ["/parametres/notifications", "notifications"],
    ["/notifications", "notifications"],
    ["/equipe/inviter", "equipe-invitation"],
  ] as const)("%s reste indisponible (%s) en mode api", (path, family) => {
    expect(unavailableFamilyOf(path)).toBe(family);
  });

  it.each([
    "/",
    "/organisations",
    "/organisations?q=port",
    "/organisations/12",
    "/organisations/12/modules",
    "/comptes",
    "/comptes/12",
    "/modules",
    "/modules/12",
    "/abonnements",
    "/abonnements/plans/gold",
    "/audit",
    "/audit/01934f6e-aaaa-7000-8000-000000000001",
    "/rgpd",
    "/rgpd/12",
    "/support",
    "/support/3a7e9c15",
    "/approbations",
    "/sante",
    "/sauvegardes",
    "/parametres",
    "/parametres/informations",
    "/parametres/securite",
    "/equipe",
    "/aide",
  ])("%s est servi par un écran réel", (path) => {
    expect(unavailableFamilyOf(path)).toBeNull();
  });

  it("refuse par défaut une route qu'aucune règle ne classe", () => {
    expect(classifyRoute("/nouvelle-famille")).toBeNull();
    expect(unavailableFamilyOf("/nouvelle-famille")).toBe("autre");
  });

  it("ne confond pas un préfixe de segment", () => {
    expect(classifyRoute("/audit-x")).toBeNull();
    expect(unavailableFamilyOf("/support-x")).toBe("autre");
    expect(classifyRoute("/organisations/12/modules-x")).toBe("organisations");
  });

  it("nomme et classe chaque famille", () => {
    expect(Object.keys(familyHasApiSource).sort()).toEqual([...GATED_FAMILIES].sort());
    expect(Object.keys(familyLabel).sort()).toEqual([...GATED_FAMILIES].sort());
    for (const label of Object.values(familyLabel)) expect(label.trim()).not.toBe("");
  });

  it("explique chaque fonction écartée par la décision d'architecture", () => {
    for (const family of GATED_FAMILIES) {
      if (family === "autre" || familyHasApiSource[family]) continue;
      expect(familyNote[family], family).toBeTruthy();
    }
  });

  it("classe chaque page de l'espace dans une famille", () => {
    const pages = pageFiles();

    expect(pages.length).toBeGreaterThan(25);
    expect(pages.filter((page) => classifyRoute(page.route) === null).map((page) => page.route)).toEqual([]);
  });

  it("ne sert en mode api que les écrans reliés au serveur", () => {
    const gated = pageFiles().filter((page) => unavailableFamilyOf(page.route) !== null).map((page) => page.route);

    expect(gated.sort()).toEqual([
      "/notifications",
      "/organisations/nouvelle",
      "/parametres/notifications",
      "/abonnements/plans/nouveau",
      "/equipe/inviter",
      "/sante/incidents/x",
      "/sauvegardes/restauration",
    ].sort());
  });
});
