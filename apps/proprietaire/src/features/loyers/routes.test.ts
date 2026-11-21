import { classifyRoute, unavailableFamilyOf } from "@eguardimmo/gestion";
import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

function pageRoutes(directory: string): string[] {
  const routes: string[] = [];
  const walk = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(join(current, entry.name));
      else if (entry.name === "page.tsx") routes.push(relative(directory, current));
    }
  };
  walk(directory);
  return routes.map((route) => `/${route.split(sep).map((segment) => (segment.startsWith("[") ? "x" : segment)).join("/")}`);
}

describe("routes Loyers de l'espace bailleur", () => {
  const loyers = pageRoutes(join(process.cwd(), "src", "app", "(espace)", "finances", "loyers"));

  it("livre les six pages attendues", () => {
    expect(loyers.map((route) => `/finances/loyers${route === "/" ? "" : route}`).sort()).toEqual([
      "/finances/loyers",
      "/finances/loyers/paiements",
      "/finances/loyers/paiements/nouveau",
      "/finances/loyers/quittances",
      "/finances/loyers/quittances/x",
      "/finances/loyers/x",
    ]);
  });

  it("classe chacune comme écran réel, servi en mode api", () => {
    for (const route of loyers) {
      const path = `/finances/loyers${route === "/" ? "" : route}`;
      expect(classifyRoute(path), path).toBe("reelle");
      expect(unavailableFamilyOf(path), path).toBeNull();
    }
  });

  it("laisse le reste de la finance du bailleur « Bientôt disponible »", () => {
    for (const path of ["/finances", "/finances/impayes/x/relance", "/finances/impayes/x/grand-livre", "/finances/factures", "/finances/factures/nouvelle", "/finances/factures/x", "/finances/factures/x/modifier", "/finances/bilan", "/finances/encaissements/acompte", "/finances/loyers-x"]) {
      expect(unavailableFamilyOf(path), path).toBe("finances");
    }
  });
});

describe("routes Recouvrement de l'espace bailleur", () => {
  const finances = pageRoutes(join(process.cwd(), "src", "app", "(espace)", "finances"));

  it("livre les impayés, la liste des dossiers et le détail d'un dossier", () => {
    expect(finances).toEqual(expect.arrayContaining(["/impayes", "/recouvrement", "/recouvrement/x"]));
  });

  it("sert les impayés et les dossiers en mode api, sans gater leurs sous-routes de démonstration réelles", () => {
    for (const path of ["/finances/impayes", "/finances/recouvrement", "/finances/recouvrement/12"]) {
      expect(classifyRoute(path), path).toBe("reelle");
      expect(unavailableFamilyOf(path), path).toBeNull();
    }
  });

  it("sert le détail d'un impayé et garde sa relance et son grand livre « Bientôt disponible »", () => {
    expect(unavailableFamilyOf("/finances/impayes/12")).toBeNull();
    for (const path of ["/finances/impayes/12/relance", "/finances/impayes/12/grand-livre"]) {
      expect(unavailableFamilyOf(path), path).toBe("finances");
    }
  });

  it("sert la saisie d'un encaissement et garde l'acompte « Bientôt disponible »", () => {
    expect(unavailableFamilyOf("/finances/encaissements/nouveau")).toBeNull();
    expect(unavailableFamilyOf("/finances/encaissements/acompte")).toBe("finances");
  });
});
