import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { pageFiles } from "../../test/pages";
import { classifyRoute, unavailableFamilyOf } from "./capabilities";
import { bankingPages, buildNavigation, buildSearchPages } from "./config";
import { agenceRoutes } from "./routes";

const BANKING_ROUTES = [agenceRoutes.banque, agenceRoutes.banqueComptes, agenceRoutes.banqueReleves, agenceRoutes.banqueImport, agenceRoutes.banqueEtats];

const financeEntries = (banking: boolean) => buildNavigation(undefined, { rent: true, banking }).sections.find((section) => section.id === "finances")?.entries ?? [];

describe("rapprochement bancaire de l'agence", () => {
  it.each([
    ...BANKING_ROUTES,
    "/finances/banque/releves/abc",
    "/finances/banque/etats/abc",
  ])("%s a un écran réel en mode api", (path) => {
    expect(classifyRoute(path)).toBe("reelle");
    expect(unavailableFamilyOf(path)).toBeNull();
  });

  it("expose l'entrée de menu Banque seulement quand le rôle y a accès", () => {
    expect(financeEntries(false).map((entry) => entry.id)).not.toContain("banque");
    const entry = financeEntries(true).find((item) => item.id === "banque");
    expect(entry?.href).toBe("/finances/banque");
    expect(entry?.label).toBe("Banque");
  });

  it("n'ajoute l'entrée de menu par défaut pour aucun rôle", () => {
    expect(buildNavigation(undefined, { rent: true }).sections.flatMap((section) => section.entries).map((entry) => entry.id)).not.toContain("banque");
  });

  it("ne propose les pages bancaires à la recherche qu'en mode api avec accès", () => {
    const hrefs = (options: { records: boolean; banking?: boolean }) => buildSearchPages(options).map((page) => page.href);
    for (const route of BANKING_ROUTES) {
      expect(hrefs({ records: false, banking: true })).toContain(route);
      expect(hrefs({ records: false, banking: false })).not.toContain(route);
      expect(hrefs({ records: false })).not.toContain(route);
      expect(hrefs({ records: true, banking: true })).not.toContain(route);
    }
    expect(bankingPages.map(([href]) => href)).toEqual(BANKING_ROUTES);
  });

  it("couvre chaque page du dossier banque par ApiOnly (aucune donnée démo en mode démo)", () => {
    const pages = pageFiles().filter((page) => page.route.startsWith("/finances/banque"));
    expect(pages.map((page) => page.route).sort()).toEqual(["/finances/banque", "/finances/banque/comptes", "/finances/banque/etats", "/finances/banque/etats/x", "/finances/banque/import", "/finances/banque/releves", "/finances/banque/releves/x"]);
    for (const page of pages) {
      const source = readFileSync(page.file, "utf8");
      const gated = source.includes("<ApiOnly>") || source.includes("<WithId");
      expect(gated, page.file).toBe(true);
    }
  });
});
