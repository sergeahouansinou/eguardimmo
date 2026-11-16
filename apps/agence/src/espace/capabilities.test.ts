import { describe, expect, it } from "vitest";
import { pageFiles } from "../../test/pages";
import { GATED_FAMILIES, classifyRoute, familyHasApiSource, familyLabel, unavailableFamilyOf } from "./capabilities";

describe("table des familles sans source API de l'agence", () => {
  it.each([
    ["/", "accueil"],
    ["/mandants", "mandants"],
    ["/mandants/nouveau", "mandants"],
    ["/mandats/12/resiliation", "mandats"],
    ["/finances/impayes/12", "finances"],
    ["/finances/reversements/lot", "finances"],
    ["/comptes-rendus/12/apercu", "comptesRendus"],
    ["/interventions/nouvelle", "interventions"],
    ["/devis", "devis"],
    ["/conformite/12", "conformite"],
    ["/documents/ajout", "documents"],
    ["/reglages/finances", "reglages"],
    ["/compte", "compte"],
    ["/compte/abonnement", "compte"],
    ["/compte/notifications", "compte"],
    ["/equipe/roles", "roles"],
    ["/locataires/invitation", "invitationLocataire"],
    ["/baux/avis-echeance", "avisEcheance"],
    ["/baux/avis-echeance?bail=12", "avisEcheance"],
    ["/finances?mois=2026-11", "finances"],
  ] as const)("%s est indisponible (%s) en mode api", (path, family) => {
    expect(unavailableFamilyOf(path)).toBe(family);
  });

  it.each([
    "/biens",
    "/biens/12/caracteristiques",
    "/biens/immeubles/12/lots",
    "/locataires",
    "/locataires/12/modifier",
    "/locataires/candidats/12",
    "/baux",
    "/baux/12/sortie",
    "/baux/etats-des-lieux/12/comparer",
    "/baux/reservations",
    "/equipe",
    "/equipe/inviter",
    "/equipe/invitation",
    "/messages",
    "/messages/12",
    "/campagnes/nouvelle",
    "/aide",
    "/notifications",
    "/compte/securite",
  ])("%s reste servi (écran réel ou garde propre)", (path) => {
    expect(unavailableFamilyOf(path)).toBeNull();
  });

  it("refuse par défaut une route qu'aucune règle ne classe", () => {
    expect(classifyRoute("/nouvelle-famille")).toBeNull();
    expect(unavailableFamilyOf("/nouvelle-famille")).toBe("autre");
  });

  it("ne confond pas un préfixe de segment", () => {
    expect(classifyRoute("/finances-x")).toBeNull();
    expect(classifyRoute("/compte/securite-x")).toBe("compte");
    expect(classifyRoute("/biens-x")).toBeNull();
  });

  it("nomme et classe chaque famille", () => {
    expect(Object.keys(familyHasApiSource).sort()).toEqual([...GATED_FAMILIES].sort());
    expect(Object.keys(familyLabel).sort()).toEqual([...GATED_FAMILIES].sort());
    for (const label of Object.values(familyLabel)) expect(label.trim()).not.toBe("");
  });

  it("classe chaque page de l'espace dans une famille gatée ou parmi les écrans réels", () => {
    const pages = pageFiles();

    expect(pages.length).toBeGreaterThan(60);
    expect(pages.filter((page) => classifyRoute(page.route) === null).map((page) => page.route)).toEqual([]);
  });

  it("ne laisse aucune famille propre à l'agence servir ses données de démonstration", () => {
    const served = pageFiles().filter((page) => unavailableFamilyOf(page.route) === null).map((page) => page.route);

    for (const route of served) expect(route).toMatch(/^\/(biens|locataires|baux|equipe|messages|campagnes|aide|notifications|compte\/securite)(\/|$)/);
    expect(served).not.toContain("/baux/avis-echeance");
    expect(served).not.toContain("/locataires/invitation");
    expect(served).not.toContain("/equipe/roles");
  });
});
