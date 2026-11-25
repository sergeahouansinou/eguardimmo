import { describe, expect, it } from "vitest";
import { isInternal, navigationHrefs, pathOf, resolves, routePatterns, sourceHrefs, sourceLiterals } from "../../test/liens";
import { accountMenu, bottomItems, helpMenu, navigation, notifications, searchPages } from "./config";

const patterns = routePatterns();

function configuredHrefs(): string[] {
  return [
    ...navigationHrefs(navigation(undefined)),
    ...bottomItems.map((item) => item.href),
    ...accountMenu.groups.flatMap((group) => group.items.map((item) => item.href)),
    accountMenu.signOut.href,
    ...helpMenu.map((item) => item.href),
    notifications.allHref,
    ...(notifications.settingsHref ? [notifications.settingsHref] : []),
    ...searchPages.map((page) => page.href),
  ];
}

describe("liens de la configuration de la console", () => {
  it("connaît les pages livrées", () => {
    expect(patterns.length).toBeGreaterThan(25);
  });

  it("pointent tous vers une page existante", () => {
    const orphelins = configuredHrefs().filter((href) => isInternal(href) && !resolves(href, patterns));
    expect(Array.from(new Set(orphelins))).toEqual([]);
  });

  it("laissent chaque page statique atteignable par la navigation, un menu, la recherche ou un lien du code", () => {
    const atteints = new Set([...configuredHrefs(), ...sourceLiterals()].filter(isInternal).map(pathOf));
    const inaccessibles = patterns.filter((pattern) => !pattern.source.includes("[^/]+") && !Array.from(atteints).some((path) => pattern.test(path)));
    expect(inaccessibles.map((pattern) => pattern.source)).toEqual([]);
  });

  it("n'a aucun lien interne mort dans le code", () => {
    expect(sourceHrefs().filter(({ href }) => isInternal(href) && !resolves(href, patterns))).toEqual([]);
  });
});
