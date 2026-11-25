import { describe, expect, it } from "vitest";
import { isExternalHref } from "@eguardimmo/shell";
import { pageFiles } from "../../test/pages";
import { unavailableFamilyOf } from "./capabilities";
import { buildNavigation, searchPages } from "@/confie-config/config";
import { apiAccountMenu, apiBottomItems, apiNavigation, apiSearchPages, withAnnouncementCount } from "./configApi";
import { toRealHref } from "@/confie-config/paths";

const entries = apiNavigation.sections.flatMap((section) => section.entries);

describe("annonces dans la navigation du propriétaire en mode api", () => {
  it("propose l’entrée Annonces vers un écran réel de /confie, avec un compteur sur cette entrée seule", () => {
    const annonces = entries.find((entry) => entry.id === "annonces");
    expect(annonces).toBeDefined();
    expect(toRealHref(annonces?.href ?? "")).toBe("/confie/annonces");
    expect(unavailableFamilyOf("/confie/annonces")).toBeNull();
    expect(apiSearchPages.map((page) => toRealHref(page.href))).toContain("/confie/annonces");
    const counted = withAnnouncementCount(apiNavigation, 3).sections.flatMap((section) => section.entries).filter((entry) => entry.count !== undefined);
    expect(counted.map((entry) => [entry.id, entry.count])).toEqual([["annonces", 3]]);
  });

  it("n’affiche aucun compteur tant que le total n’est pas connu", () => {
    expect(withAnnouncementCount(apiNavigation, undefined)).toBe(apiNavigation);
  });
});

describe("décomptes de charges dans la navigation du propriétaire", () => {
  it("propose l’entrée vers un écran réel en mode api, avec sa page dans la recherche", () => {
    const charges = entries.find((entry) => entry.id === "charges");
    expect(charges?.label).toBe("Décomptes de charges");
    expect(toRealHref(charges?.href ?? "")).toBe("/confie/charges");
    expect(unavailableFamilyOf("/confie/charges")).toBeNull();
    expect(unavailableFamilyOf("/confie/charges/0193a5e1")).toBeNull();
    expect(apiSearchPages.map((page) => toRealHref(page.href))).toContain("/confie/charges");
  });

  it("n’ajoute aucune entrée ni donnée d’exemple en mode démonstration", () => {
    const demo = buildNavigation(undefined).sections.flatMap((section) => section.entries);
    expect(demo.map((entry) => toRealHref(entry.href))).not.toContain("/confie/charges");
    expect(searchPages.map((page) => toRealHref(page.href))).not.toContain("/confie/charges");
  });
});

describe("liens de la navigation du propriétaire en mode api", () => {
  const hrefs = [
    ...entries,
    ...apiNavigation.footer,
    ...apiBottomItems,
    ...apiAccountMenu.groups.flatMap((group) => group.items),
    ...(apiAccountMenu.footerItems ?? []),
    ...apiSearchPages,
  ].map((item) => toRealHref(item.href));
  const internal = hrefs.filter((link) => !isExternalHref(link) && link !== "/");
  const pages = new Set(pageFiles().map((page) => page.route));

  it("mène chaque lien interne à une page existante servie par le serveur", () => {
    expect(internal.length).toBeGreaterThan(20);
    expect(internal.filter((link) => !pages.has(link))).toEqual([]);
    expect(internal.filter((link) => unavailableFamilyOf(link) !== null)).toEqual([]);
  });

  it("ouvre la fiscalité, l’aide, les messages et les informations depuis la navigation", () => {
    expect(entries.map((entry) => entry.id)).toEqual(expect.arrayContaining(["fiscalite", "messages", "support"]));
    expect(apiNavigation.footer.map((entry) => entry.id)).toContain("aide");
    expect(internal).toEqual(expect.arrayContaining(["/confie/fiscalite", "/confie/aide", "/confie/messages", "/confie/informations"]));
  });
});
