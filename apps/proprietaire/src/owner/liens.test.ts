import { buildNavigation as buildBailleurNavigation, plannedScreens } from "@eguardimmo/gestion";
import { describe, expect, it } from "vitest";
import { accountMenu, bottomItems, buildNavigation, notifications, searchPages } from "@/confie-config/config";
import { toRealHref } from "@/confie-config/paths";
import { isInternal, navigationHrefs, pathOf, resolves, routePatterns, sourceHrefs, sourceLiterals } from "../../test/liens";
import { apiAccountMenu, apiBottomItems, apiNavigation, apiNotifications, apiSearchPages } from "./configApi";

const patterns = routePatterns();

function confieHrefs(): string[] {
  const menuHrefs = (menu: typeof accountMenu) => menu.groups.flatMap((group) => group.items.map((item) => item.href));
  const shell = [
    ...navigationHrefs(buildNavigation(undefined)),
    ...navigationHrefs(apiNavigation),
    ...bottomItems.map((item) => item.href),
    ...apiBottomItems.map((item) => item.href),
    ...menuHrefs(accountMenu),
    ...menuHrefs(apiAccountMenu),
    notifications.allHref,
    ...(notifications.settingsHref ? [notifications.settingsHref] : []),
    apiNotifications.allHref,
    ...(apiNotifications.settingsHref ? [apiNotifications.settingsHref] : []),
    ...searchPages.map((page) => page.href),
    ...apiSearchPages.map((page) => page.href),
  ];
  return shell.map(toRealHref);
}

function bailleurHrefs(): string[] {
  const options = { rent: true, compliance: true, tax: true, timezone: true, support: { manageAccess: true, requests: 1, access: 1 } };
  return [
    ...navigationHrefs(buildBailleurNavigation(undefined, options)),
    ...navigationHrefs(buildBailleurNavigation(undefined, { rent: false })),
    ...plannedScreens().keys(),
  ];
}

describe("liens des configurations de l'espace propriétaire", () => {
  it("connaît les pages livrées", () => {
    expect(patterns.length).toBeGreaterThan(100);
  });

  it("de l'espace confié pointent tous vers une page existante", () => {
    const orphelins = confieHrefs().filter((href) => isInternal(href) && !resolves(href, patterns));
    expect(Array.from(new Set(orphelins))).toEqual([]);
  });

  it("de l'espace bailleur pointent tous vers une page existante", () => {
    const orphelins = bailleurHrefs().filter((href) => isInternal(href) && !resolves(href, patterns));
    expect(Array.from(new Set(orphelins))).toEqual([]);
  });

  it("laissent chaque page statique atteignable par la navigation, un menu, la recherche ou un lien du code", () => {
    const atteints = new Set([...confieHrefs(), ...bailleurHrefs(), ...sourceLiterals()].filter(isInternal).map(pathOf));
    const inaccessibles = patterns.filter((pattern) => !pattern.source.includes("[^/]+") && !Array.from(atteints).some((path) => pattern.test(path) || pattern.test(`/confie${path}`)));
    expect(inaccessibles.map((pattern) => pattern.source)).toEqual([]);
  });

  it("n'a aucun lien interne mort dans le code", () => {
    expect(sourceHrefs().filter(({ href }) => isInternal(href) && !resolves(href, patterns) && !resolves(toRealHref(href), patterns))).toEqual([]);
  });
});
