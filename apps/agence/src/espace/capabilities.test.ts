import { describe, expect, it } from "vitest";
import { pageFiles } from "../../test/pages";
import { GATED_FAMILIES, classifyRoute, familyHasApiSource, familyLabel, unavailableFamilyOf } from "./capabilities";

describe("table des familles sans source API de l'agence", () => {
  it.each([
    ["/finances/impayes/12/grand-livre", "finances"],
    ["/finances/honoraires/bareme/extra", "finances"],
    ["/devis/12", "devis"],
    ["/documents/ajout/extra", "documents"],
    ["/reglages/finances/extra", "reglages"],
    ["/reglages/inconnu", "reglages"],
    ["/reglages/acces-support/extra", "reglages"],
    ["/support/12/extra", "autre"],
    ["/support/nouvelle/extra", "autre"],
    ["/compte/abonnement", "compte"],
    ["/compte/inconnu", "compte"],
    ["/equipe/roles/extra", "roles"],
    ["/finances?mois=2026-11", "finances"],
    ["/finances/encaissements/acompte", "finances"],
    ["/finances/encaissements-x", "finances"],
    ["/finances/impayes/12/relance", "finances"],
    ["/finances/loyers-x", "finances"],
    ["/finances/factures-x", "finances"],
  ] as const)("%s est indisponible (%s) en mode api", (path, family) => {
    expect(unavailableFamilyOf(path)).toBe(family);
  });

  it.each([
    "/",
    "/comptes-rendus",
    "/comptes-rendus/nouveau",
    "/comptes-rendus/12/apercu",
    "/comptes-rendus/releve",
    "/interventions",
    "/interventions/nouvelle",
    "/interventions/prestataires",
    "/interventions/12",
    "/mandants",
    "/mandants/nouveau",
    "/mandants/12",
    "/mandats",
    "/mandats?etat=a_renouveler",
    "/mandats/nouveau",
    "/mandats/avenant",
    "/mandats/12",
    "/mandats/12/resiliation",
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
    "/baux/avis-echeance",
    "/baux/avis-echeance?bail=12",
    "/baux/avis-echeance?mois=2026-11",
    "/locataires/invitation",
    "/reglages",
    "/reglages/",
    "/reglages?x=1",
    "/reglages/acces-support",
    "/support",
    "/support/",
    "/support/nouvelle",
    "/support/0193a5e1-0000-7000-8000-000000000001",
    "/equipe",
    "/equipe/inviter",
    "/equipe/invitation",
    "/messages",
    "/messages/12",
    "/messages/equipe",
    "/messages/fil/12",
    "/campagnes",
    "/campagnes/nouvelle",
    "/campagnes/0193a5e1-0000-7000-8000-0000000002a1",
    "/campagnes/0193a5e1-0000-7000-8000-0000000002a1/modifier",
    "/aide",
    "/notifications",
    "/compte",
    "/compte/",
    "/compte?x=1",
    "/compte/securite",
    "/compte/notifications",
    "/finances/impayes",
    "/finances/impayes/",
    "/finances/impayes?lease=12",
    "/finances/impayes/12",
    "/finances/encaissements",
    "/finances/encaissements/",
    "/finances/encaissements?bail=12",
    "/finances/encaissements/nouveau",
    "/finances/encaissements/nouveau?bail=12",
    "/finances/recouvrement",
    "/finances/recouvrement/12",
    "/finances/loyers",
    "/finances/loyers/12",
    "/finances/loyers?statut=paid",
    "/finances/loyers/paiements",
    "/finances/loyers/paiements/nouveau",
    "/finances/loyers/quittances",
    "/finances/loyers/quittances/12",
    "/finances/factures",
    "/finances/factures?statut=issued",
    "/finances/factures/nouvelle",
    "/finances/factures/12",
    "/finances/factures/12/modifier",
    "/finances/reversements",
    "/finances/reversements/lot",
    "/finances/reversements/lot?lot=12",
    "/finances/reversements/demandes-iban",
    "/finances/reversements/demandes-iban?mandant=12",
    "/finances/reversements/12",
    "/finances/honoraires",
    "/finances/honoraires?mois=2026-10",
    "/finances/fonds",
    "/finances/cloture",
    "/finances/fiscalite",
    "/finances/fiscalite/12",
    "/analytique",
    "/analytique/revenus-depenses",
    "/analytique/occupation",
    "/finances/depenses",
    "/finances/depenses/nouvelle",
    "/finances/depenses/12",
    "/finances/charges",
    "/finances/charges/nouveau",
    "/finances/charges/12",
    "/finances/charges/decomptes/12",
    "/finances/charges/cles",
    "/finances/charges/cles?bien=12",
    "/conformite",
    "/conformite/12",
    "/conformite?etat=expired",
    "/documents",
    "/documents/",
    "/documents?x=1",
    "/documents/ajout",
    "/documents/ajout/",
    "/devis",
    "/devis?intervention=12",
    "/equipe/roles",
    "/equipe/roles/",
    "/finances/honoraires/bareme",
    "/finances/honoraires/bareme/",
    "/reglages/finances",
    "/reglages/finances/",
  ])("%s reste servi (écran réel ou garde propre)", (path) => {
    expect(unavailableFamilyOf(path)).toBeNull();
  });

  it("garde indisponibles les pages d'analytique que l'agence ne sert pas", () => {
    for (const path of ["/analytique/rentabilite", "/analytique/previsionnel", "/finances/fiscalite/12/extra"]) expect(unavailableFamilyOf(path), path).not.toBeNull();
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

    for (const route of served.filter((candidate) => candidate !== "/")) expect(route).toMatch(/^\/(comptes-rendus|biens|locataires|baux|interventions|mandants|mandats|equipe|messages|campagnes|aide|notifications|support|agenda|taches|contacts|journal|compte(?=$)|compte\/securite|compte\/notifications|reglages(?=$|\/acces-support$|\/finances$|\/fuseau-horaire$)|finances\/impayes(?=$|\/x$)|finances\/encaissements(?=$|\/nouveau$)|finances\/banque|finances\/paiements-en-ligne|finances\/loyers|finances\/factures|finances\/reversements|finances\/honoraires|finances\/fonds|finances\/cloture|finances\/fiscalite|analytique(?=$|\/revenus-depenses$|\/occupation$)|finances\/depenses|finances\/charges|finances\/recouvrement|conformite|documents(?=$|\/ajout$)|devis$)(\/|$)/);
    expect(served.filter((route) => route.startsWith("/finances/impayes")).sort()).toEqual(["/finances/impayes", "/finances/impayes/x"]);
    expect(served.filter((route) => route.startsWith("/finances/encaissements")).sort()).toEqual(["/finances/encaissements", "/finances/encaissements/nouveau"]);
    expect(served.filter((route) => route.startsWith("/reglages")).sort()).toEqual(["/reglages", "/reglages/acces-support", "/reglages/finances", "/reglages/fuseau-horaire"]);
    expect(served.filter((route) => route.startsWith("/support")).sort()).toEqual(["/support", "/support/nouvelle", "/support/x"]);
    expect(served).toEqual(expect.arrayContaining(["/equipe/roles", "/finances/honoraires/bareme", "/devis", "/documents/ajout"]));
  });
});
