import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createDemoData } from "@/features/portefeuille/demo";
import { indexPortefeuille, isOperational, mandatState } from "@/features/portefeuille/selectors";
import { accountMenu, addMenu, bottomItems, buildNavigation, buildSearchPages, helpMenu, plannedScreens } from "./config";
import { demoShell } from "./demo";
import { agenceRoutes, bailHref, bienHref, locataireHref, mandantHref, mandatHref, mandatTerminationHref } from "./routes";

const OWNED_ROUTES = [
  "/",
  "/mandants",
  "/mandants/nouveau",
  "/mandats",
  "/mandats/nouveau",
  "/mandats/avenant",
  "/biens",
  "/biens/nouveau",
  "/locataires",
  "/locataires/invitation",
  "/baux",
  "/baux/nouveau",
  "/baux/avis-echeance",
  "/messages",
  "/messages/nouveau",
  "/campagnes",
  "/campagnes/nouvelle",
  "/aide",
];

const knownHrefs = new Set<string>(Object.values(agenceRoutes));

describe("navigation de l'espace agence", () => {
  const navigation = buildNavigation();
  const entries = [...navigation.sections.flatMap((section) => section.entries), ...navigation.footer];

  it("liste les 3 sections et le pied de navigation sans doublon", () => {
    expect(navigation.sections.map((section) => section.label)).toEqual(["Gestion", "Finances", "Suivi"]);
    expect(entries).toHaveLength(18);
    expect(new Set(entries.map((entry) => entry.href)).size).toBe(entries.length);
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(entries.length);
  });

  it("ne pointe que vers des routes connues", () => {
    const hrefs = [
      ...entries.map((entry) => entry.href),
      ...bottomItems.map((item) => item.href),
      ...addMenu.flatMap((group) => group.items.map((item) => item.href)),
      ...helpMenu.map((item) => item.href),
      ...accountMenu.groups.flatMap((group) => group.items.map((item) => item.href)),
      ...(accountMenu.footerItems ?? []).map((item) => item.href),
    ];
    for (const href of hrefs) {
      expect(knownHrefs.has(href) || plannedScreens.has(href), href).toBe(true);
    }
  });

  it("affiche les compteurs fournis par la source", () => {
    const withCounts = buildNavigation(demoShell.counts);
    const mandats = withCounts.sections.flatMap((section) => section.entries).find((entry) => entry.id === "mandats");
    expect(mandats?.count).toBe(6);
  });
});

describe("écrans prévus", () => {
  it("ne recouvrent aucune route livrée par ce lot", () => {
    for (const href of OWNED_ROUTES) expect(plannedScreens.has(href), href).toBe(false);
  });

  it("n'ont pas de route dynamique en doublon", () => {
    for (const href of plannedScreens.keys()) {
      expect(href.startsWith("/")).toBe(true);
      expect(href).not.toMatch(/\[|\]/);
    }
  });
});

describe("liens de détail", () => {
  it("construisent les routes dynamiques", () => {
    expect(mandantHref("marc-chevalier")).toBe("/mandants/marc-chevalier");
    expect(mandatHref("m-2025-0142")).toBe("/mandats/m-2025-0142");
    expect(mandatTerminationHref("m-2025-0142")).toBe("/mandats/m-2025-0142/resiliation");
    expect(bienHref("apt-12")).toBe("/biens/apt-12");
    expect(locataireHref("anais-roux")).toBe("/locataires/anais-roux");
    expect(bailHref("b-2024-018")).toBe("/baux/b-2024-018");
  });
});

describe("recherche globale", () => {
  const pages = buildSearchPages();

  it("couvre les pages, mandants, lots et locataires en cours", () => {
    const labels = pages.map((page) => page.label);
    expect(labels).toContain("Accueil");
    expect(labels).toContain("Mandant, Marc Chevalier");
    expect(labels.some((label) => label.startsWith("Lot, Apt 12"))).toBe(true);
    expect(labels).toContain("Locataire, Anaïs Roux");
  });

  it("exclut locataires archivés et sans bail, sans doublon d'adresse", () => {
    const labels = pages.map((page) => page.label);
    expect(labels).not.toContain("Locataire, Pauline Lefort");
    expect(labels).not.toContain("Locataire, Chloé Martin");
    const hrefs = pages.map((page) => page.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});

function staticRoutes(dir: string, prefix = ""): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (!entry.isDirectory() || entry.name.startsWith("[")) return [];
    const route = `${prefix}/${entry.name}`;
    const own = readdirSync(join(dir, entry.name)).includes("page.tsx") ? [route] : [];
    return [...own, ...staticRoutes(join(dir, entry.name), route)];
  });
}

describe("recherche des pages livrées", () => {
  const hrefs = new Set(buildSearchPages().map((page) => page.href));

  it("propose chaque page statique de l'espace", () => {
    const routes = ["/", ...staticRoutes(join(process.cwd(), "src/app/(espace)"))];
    expect(routes.length).toBeGreaterThan(30);
    for (const route of routes) expect(hrefs.has(route), route).toBe(true);
  });

  it("propose les pages citées par les menus", () => {
    const menuHrefs = [
      ...addMenu.flatMap((group) => group.items.map((item) => item.href)),
      ...helpMenu.map((item) => item.href),
      ...accountMenu.groups.flatMap((group) => group.items.map((item) => item.href)),
    ];
    for (const href of menuHrefs) expect(hrefs.has(href), href).toBe(true);
  });

  it("nomme les pages récentes de façon cherchable", () => {
    const labels = buildSearchPages().map((page) => page.label);
    for (const label of ["Nouvel encaissement, saisir un paiement", "Lot de virements", "Barème des honoraires", "Devis à soumettre", "Inviter un collaborateur", "Campagnes", "Centre d'aide"]) {
      expect(labels, label).toContain(label);
    }
  });
});

describe("cohérence de la démonstration", () => {
  const index = indexPortefeuille(createDemoData());

  it("aligne les compteurs de la coquille sur les fixtures", () => {
    const operational = index.data.mandats.filter((mandat) => isOperational(mandatState(mandat, index.data.todayIso)));
    expect(demoShell.counts.mandats).toBe(operational.length);
    expect(demoShell.counts.biens).toBe(index.data.biens.length);
    expect(demoShell.counts.impayes).toBe(index.data.baux.filter((bail) => bail.overdueSinceIso).length);
  });
});
