import { describe, expect, it } from "vitest";
import { toRealHref, toShellHref, toShellPath } from "./paths";

describe("chemins de la coquille propriétaire", () => {
  it.each([
    ["/confie", "/"],
    ["/confie/biens", "/biens"],
    ["/confie/agence/mandat", "/agence/mandat"],
    ["/", "/ext"],
    ["/choix-du-profil", "/ext/choix-du-profil"],
  ])("convertit %s en %s et inversement", (real, shell) => {
    expect(toShellHref(real)).toBe(shell);
    expect(toRealHref(shell)).toBe(real);
  });

  it("redirige les liens de notification vers les pages réelles", () => {
    expect(toRealHref("/reversements")).toBe("/confie/loyers");
    expect(toRealHref("/compte-de-paiement")).toBe("/confie/compte-de-paiement");
    expect(toRealHref("/interventions/0193a5e1")).toBe("/confie/interventions/0193a5e1");
    expect(toRealHref("/comptes-rendus/0193a5e1")).toBe("/confie/comptes-rendus/0193a5e1");
  });

  it("laisse intactes les adresses d'une autre application", () => {
    const url = "http://localhost:3040/profils";
    expect(toShellHref(url)).toBe(url);
    expect(toRealHref(url)).toBe(url);
  });

  it("n'active l'accueil que sur /confie exactement", () => {
    expect(toShellPath("/confie")).toBe("/");
    expect(toShellPath("/confie/biens/apt-12")).toBe("/biens/apt-12");
    expect(toShellPath("/")).toBe("/ext");
  });
});
