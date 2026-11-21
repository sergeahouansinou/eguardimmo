import { describe, expect, it } from "vitest";
import { pageFiles } from "../../test/pages";
import { GATED_FAMILIES, classifyRoute, familyHasApiSource, familyLabel, unavailableFamilyOf } from "./capabilities";

describe("table des familles sans source API du locataire", () => {
  it.each([
    ["/loyers/payer/simulation/12", "simulation"],
    ["/loyers/payer/simulation", "simulation"],
    ["/loyers/payer/extra", "loyers"],
    ["/etats-des-lieux/12/extra", "etatsDesLieux"],
    ["/documents/12", "documents"],
    ["/assurance/deposer/extra", "assurance"],
    ["/bail/conge/extra", "conge"],
    ["/compte/modifier/extra", "compte"],
    ["/paiement/retour/extra", "autre"],
    ["/paiement", "autre"],
    ["/loyers/prelevement", "prelevement"],
    ["/loyers/prelevement/extra", "prelevement"],
    ["/loyers/prelevement-x", "loyers"],
    ["/loyers/regularisation/12/extra", "loyers"],
    ["/loyers/regularisation-x", "loyers"],
    ["/loyers/inconnu", "loyers"],
    ["/loyers/echeances", "loyers"],
    ["/loyers/echeances/12/extra", "loyers"],
    ["/loyers/quittances/12/extra", "loyers"],
    ["/loyers/paiements/12/extra", "loyers"],
    ["/interventions/12/extra", "interventions"],
    ["/messages/12/extra", "messages"],
    ["/messages/nouveau/extra", "messages"],
    ["/compte/securite/extra", "compte"],
    ["/compte/inconnu", "compte"],
    ["/notifications/inconnu", "notifications"],
    ["/support/12/extra", "autre"],
    ["/support/nouvelle/extra", "autre"],
  ] as const)("%s est indisponible (%s) en mode api", (path, family) => {
    expect(unavailableFamilyOf(path)).toBe(family);
  });

  it.each([
    "/",
    "/bail",
    "/bail/0193a5e1-0000-7000-8000-000000000001",
    "/acces",
    "/aide",
    "/bail/",
    "/loyers",
    "/loyers/",
    "/loyers?bail=0193a5e1-0000-7000-8000-000000000001",
    "/loyers/echeances/0193a5e1-0000-7000-8000-000000000001",
    "/loyers/quittances",
    "/loyers/quittances/0193a5e1-0000-7000-8000-000000000001",
    "/loyers/paiements",
    "/loyers/paiements/0193a5e1-0000-7000-8000-000000000001",
    "/loyers/regularisation",
    "/loyers/regularisation/",
    "/loyers/regularisation?bail=0193a5e1-0000-7000-8000-000000000001",
    "/loyers/regularisation/0193a5e1-0000-7000-8000-000000000001",
    "/compte",
    "/compte/",
    "/compte/securite",
    "/compte/modifier",
    "/compte?x=1",
    "/notifications",
    "/notifications/",
    "/notifications/toutes",
    "/documents",
    "/documents?bail=0193a5e1-0000-7000-8000-000000000001",
    "/bail/conge",
    "/bail/conge?bail=0193a5e1-0000-7000-8000-000000000001",
    "/assurance",
    "/assurance/deposer",
    "/assurance/deposer?bail=0193a5e1-0000-7000-8000-000000000001",
    "/etats-des-lieux",
    "/etats-des-lieux/0193a5e1-0000-7000-8000-000000000001",
    "/loyers/payer",
    "/loyers/payer?echeance=0193a5e1-0000-7000-8000-000000000001",
    "/paiement/retour",
    "/paiement/retour?paiement=0193a5e1-0000-7000-8000-000000000001",
    "/interventions",
    "/interventions/",
    "/interventions/nouvelle",
    "/interventions/0193a5e1-0000-7000-8000-000000000001",
    "/messages",
    "/messages/",
    "/messages/nouveau",
    "/messages/0193a5e1-0000-7000-8000-000000000001",
    "/support",
    "/support/",
    "/support/nouvelle",
    "/support/0193a5e1-0000-7000-8000-000000000001",
  ])(
    "%s reste servi (écran réel)",
    (path) => {
      expect(unavailableFamilyOf(path)).toBeNull();
    },
  );

  it.each(["/bail/conge", "/assurance", "/documents", "/etats-des-lieux", "/etats-des-lieux/0193a5e1-0000-7000-8000-000000000001", "/loyers/payer"])(
    "sert le lien de notification du serveur %s",
    (href) => {
      expect(unavailableFamilyOf(href)).toBeNull();
    },
  );

  it("refuse par défaut une route qu'aucune règle ne classe", () => {
    expect(classifyRoute("/nouvelle-famille")).toBeNull();
    expect(unavailableFamilyOf("/nouvelle-famille")).toBe("autre");
  });

  it("ne confond pas un préfixe de segment", () => {
    expect(classifyRoute("/loyers-x")).toBeNull();
    expect(classifyRoute("/acces-x")).toBeNull();
    expect(classifyRoute("/bail/conge-x")).toBe("reelle");
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

  it("ne sert en api que les écrans réels du locataire", () => {
    const served = pageFiles().filter((page) => unavailableFamilyOf(page.route) === null).map((page) => page.route).sort();

    expect(served).toEqual([
      "/",
      "/acces",
      "/aide",
      "/annonces",
      "/annonces/x",
      "/assurance",
      "/assurance/deposer",
      "/bail",
      "/bail/conge",
      "/bail/x",
      "/compte",
      "/compte/modifier",
      "/compte/securite",
      "/documents",
      "/etats-des-lieux",
      "/etats-des-lieux/x",
      "/interventions",
      "/interventions/nouvelle",
      "/interventions/x",
      "/loyers",
      "/loyers/echeances/x",
      "/loyers/paiements",
      "/loyers/paiements/x",
      "/loyers/payer",
      "/loyers/quittances",
      "/loyers/quittances/x",
      "/loyers/regularisation",
      "/loyers/regularisation/x",
      "/messages",
      "/messages/nouveau",
      "/messages/x",
      "/notifications",
      "/notifications/toutes",
      "/paiement/retour",
      "/support",
      "/support/nouvelle",
      "/support/x",
    ]);
  });
});
