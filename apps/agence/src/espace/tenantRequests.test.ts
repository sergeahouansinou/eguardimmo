import { tenantRequestsPermissions } from "@eguardimmo/gestion";
import { describe, expect, it } from "vitest";
import { buildNavigation, buildSearchPages } from "./config";
import type { TenantRequestsNavigation } from "./config";
import { classifyRoute } from "./capabilities";

function navigationFor(role: string): TenantRequestsNavigation {
  const permissions = tenantRequestsPermissions(role);
  return { manage: permissions.manage, payments: permissions.readPayments };
}

function entryIds(tenantRequests: TenantRequestsNavigation | undefined): string[] {
  const entries = buildNavigation(undefined, { rent: true, ...(tenantRequests ? { tenantRequests } : {}) }).sections.flatMap((section) => section.entries);
  return entries.flatMap((entry) => [entry.id, ...(entry.children?.map((child) => child.id) ?? [])]);
}

describe("demandes des locataires dans la navigation", () => {
  it.each(["owner", "admin", "manager"] as const)("%s voit congés, assurances et paiements en ligne", (role) => {
    const ids = entryIds(navigationFor(role));
    expect(ids).toEqual(expect.arrayContaining(["baux-conges", "conformite-assurances", "paiements-en-ligne"]));
  });

  it("le comptable ne voit ni congés ni assurances, mais les paiements en ligne", () => {
    const ids = entryIds(navigationFor("accountant"));
    expect(ids).not.toContain("baux-conges");
    expect(ids).not.toContain("conformite-assurances");
    expect(ids).toContain("paiements-en-ligne");
  });

  it("n'affiche rien en mode démonstration", () => {
    const ids = entryIds(undefined);
    for (const id of ["baux-conges", "conformite-assurances", "paiements-en-ligne"]) expect(ids).not.toContain(id);
  });

  it("pointe chaque entrée vers sa route", () => {
    const entries = buildNavigation(undefined, { rent: true, tenantRequests: { manage: true, payments: true } }).sections.flatMap((section) => section.entries.flatMap((entry) => [entry, ...(entry.children ?? [])]));
    const href = (id: string) => entries.find((entry) => entry.id === id)?.href;
    expect(href("baux-conges")).toBe("/baux/conges");
    expect(href("conformite-assurances")).toBe("/conformite/assurances");
    expect(href("paiements-en-ligne")).toBe("/finances/paiements-en-ligne");
  });
});

describe("demandes des locataires dans la recherche", () => {
  const hrefs = (options: Parameters<typeof buildSearchPages>[0]) => new Set(buildSearchPages(options).map((page) => page.href));

  it("propose les trois pages en mode api pour un gestionnaire", () => {
    const pages = hrefs({ records: false, tenantRequests: { manage: true, payments: true } });
    for (const route of ["/baux/conges", "/conformite/assurances", "/finances/paiements-en-ligne"]) expect(pages.has(route), route).toBe(true);
  });

  it("ne propose au comptable que les paiements en ligne", () => {
    const pages = hrefs({ records: false, tenantRequests: { manage: false, payments: true } });
    expect(pages.has("/finances/paiements-en-ligne")).toBe(true);
    expect(pages.has("/baux/conges")).toBe(false);
    expect(pages.has("/conformite/assurances")).toBe(false);
  });

  it("ne propose aucune de ces pages en démonstration", () => {
    const pages = hrefs({ records: true });
    for (const route of ["/baux/conges", "/conformite/assurances", "/finances/paiements-en-ligne"]) expect(pages.has(route), route).toBe(false);
  });
});

describe("capacités des routes des demandes des locataires", () => {
  it.each(["/baux/conges", "/conformite/assurances", "/finances/paiements-en-ligne"])("%s est servie par l'API", (route) => {
    expect(classifyRoute(route)).toBe("reelle");
  });
});
