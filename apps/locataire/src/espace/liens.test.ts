import { describe, expect, it } from "vitest";
import { isInternal, navigationHrefs, pathOf, resolves, routePatterns, sourceHrefs, sourceLiterals } from "../../test/liens";
import { accountMenu, bottomItems, buildNavigation, notifications, searchPages } from "./config";
import { apiAccountMenu, apiBottomItems, apiNavigation, apiSearchPages, withAnnouncementCount, withMessageCount, withSupportCount } from "./configApi";

const patterns = routePatterns();

function configuredHrefs(): string[] {
  const api = withSupportCount(withAnnouncementCount(withMessageCount(apiNavigation, 1), 1), 1);
  const menuHrefs = (menu: typeof accountMenu) => [...menu.groups.flatMap((group) => group.items.map((item) => item.href)), ...(menu.footerItems ?? []).map((item) => item.href)];
  return [
    ...navigationHrefs(buildNavigation()),
    ...navigationHrefs(api),
    ...bottomItems.map((item) => item.href),
    ...apiBottomItems.map((item) => item.href),
    ...menuHrefs(accountMenu),
    ...menuHrefs(apiAccountMenu),
    notifications.allHref,
    ...(notifications.settingsHref ? [notifications.settingsHref] : []),
    ...searchPages.map((page) => page.href),
    ...apiSearchPages.map((page) => page.href),
  ];
}

describe("liens de la configuration de l'espace locataire", () => {
  it("connaît les pages livrées", () => {
    expect(patterns.length).toBeGreaterThan(30);
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
