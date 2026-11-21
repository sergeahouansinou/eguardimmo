import { describe, expect, it } from "vitest";
import { isInternal, navigationHrefs, pathOf, resolves, routePatterns, sourceHrefs, sourceLiterals } from "../../test/liens";
import { accountMenu, addMenu, apiOnlyPages, bankingPages, bottomItems, buildNavigation, buildSearchPages, deliveredPages, helpMenu, notifications, plannedScreens } from "./config";
import type { NavigationOptions } from "./config";
import { agenceRoutes } from "./routes";

const TOUT: NavigationOptions = {
  rent: true,
  invoicing: true,
  ownerFunds: true,
  charges: true,
  banking: true,
  tenantRequests: { manage: true, payments: true },
  support: { manageAccess: true, requests: 1, access: 1 },
  planning: true,
  contacts: true,
  activity: true,
  tax: true,
  analytics: true,
  timezone: true,
};

const patterns = routePatterns();

function menuHrefs(): string[] {
  return [
    ...bottomItems.map((item) => item.href),
    ...addMenu.flatMap((group) => group.items.map((item) => item.href)),
    ...helpMenu.map((item) => item.href),
    ...accountMenu.groups.flatMap((group) => group.items.map((item) => item.href)),
    ...(accountMenu.footerItems ?? []).map((item) => item.href),
    notifications.allHref,
    ...(notifications.settingsHref ? [notifications.settingsHref] : []),
  ];
}

function searchHrefs(): string[] {
  const options = { records: false, banking: true, tenantRequests: { manage: true, payments: true } };
  return [...buildSearchPages(), ...buildSearchPages(options)].map((page) => page.href);
}

function configuredHrefs(): string[] {
  return [
    ...navigationHrefs(buildNavigation(undefined, TOUT)),
    ...navigationHrefs(buildNavigation(undefined, { rent: false })),
    ...menuHrefs(),
    ...searchHrefs(),
    ...deliveredPages.map(([href]) => href),
    ...apiOnlyPages.map(([href]) => href),
    ...bankingPages.map(([href]) => href),
    ...plannedScreens.keys(),
    ...Object.values(agenceRoutes),
  ];
}

describe("liens de la configuration de l'espace agence", () => {
  it("connaît les pages livrées", () => {
    expect(patterns.length).toBeGreaterThan(100);
  });

  it("pointent tous vers une page existante", () => {
    const orphelins = configuredHrefs().filter((href) => isInternal(href) && !resolves(href, patterns));
    expect(Array.from(new Set(orphelins))).toEqual([]);
  });

  it("n'omettent aucune page statique : chacune est atteignable par la navigation, un menu, la recherche ou un lien du code", () => {
    const atteints = new Set([...configuredHrefs(), ...sourceLiterals()].filter(isInternal).map(pathOf));
    const statiques = routePatterns().length;
    expect(statiques).toBeGreaterThan(0);
    const dynamiques = (pattern: RegExp) => pattern.source.includes("[^/]+");
    const inaccessibles = patterns.filter((pattern) => !dynamiques(pattern) && !Array.from(atteints).some((path) => pattern.test(path)));
    expect(inaccessibles.map((pattern) => pattern.source)).toEqual([]);
  });

  it("n'a aucun lien interne mort dans le code", () => {
    const morts = sourceHrefs().filter(({ href }) => isInternal(href) && !resolves(href, patterns));
    expect(morts).toEqual([]);
  });
});
