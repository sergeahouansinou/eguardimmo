import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createDemoData } from "@/features/portefeuille/demo";
import { indexPortefeuille, isOperational, mandatState } from "@/features/portefeuille/selectors";
import { accountMenu, addMenu, apiOnlyPages, bottomItems, buildNavigation, buildSearchPages, helpMenu, plannedScreens } from "./config";
import type { SupportNavigation } from "./config";
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

describe("entrée Loyers de la navigation", () => {
  const finances = (rent: boolean) => buildNavigation(undefined, { rent }).sections.find((section) => section.id === "finances")?.entries ?? [];

  it("n'apparaît qu'en mode api, vers les échéances de loyer", () => {
    expect(finances(false).map((entry) => entry.id)).not.toContain("loyers");
    expect(finances(true).find((entry) => entry.id === "loyers")?.href).toBe("/finances/loyers");
  });
});

describe("entrée Factures de la navigation", () => {
  const finances = (invoicing: boolean) => buildNavigation(undefined, { rent: true, invoicing }).sections.find((section) => section.id === "finances")?.entries ?? [];

  it("n'apparaît qu'en mode api, vers la liste des factures et avoirs", () => {
    expect(finances(false).map((entry) => entry.id)).not.toContain("factures");
    expect(finances(true).find((entry) => entry.id === "factures")?.href).toBe("/finances/factures");
  });

  it("n'expose la facturation à la recherche qu'en mode api", () => {
    expect(buildSearchPages().some((page) => page.href === "/finances/factures")).toBe(false);
    expect(buildSearchPages({ records: false }).filter((page) => page.href.startsWith("/finances/factures")).map((page) => page.href)).toEqual(["/finances/factures", "/finances/factures/nouvelle"]);
  });
});

describe("entrées Fonds de tiers et Clôture de la navigation", () => {
  const finances = (ownerFunds: boolean) => buildNavigation(undefined, { rent: true, ownerFunds }).sections.find((section) => section.id === "finances")?.entries ?? [];

  it("n'apparaissent qu'en mode api, après les honoraires", () => {
    expect(finances(false).map((entry) => entry.id)).not.toContain("fonds");
    expect(finances(false).map((entry) => entry.id)).not.toContain("cloture");
    const ids = finances(true).map((entry) => entry.id);
    expect(ids.indexOf("fonds")).toBe(ids.indexOf("honoraires") + 1);
    expect(finances(true).find((entry) => entry.id === "fonds")?.href).toBe("/finances/fonds");
    expect(finances(true).find((entry) => entry.id === "cloture")?.href).toBe("/finances/cloture");
  });

  it("ne les expose à la recherche qu'en mode api", () => {
    expect(buildSearchPages().some((page) => page.href === "/finances/fonds" || page.href === "/finances/cloture")).toBe(false);
    expect(buildSearchPages({ records: false }).filter((page) => page.href === "/finances/fonds" || page.href === "/finances/cloture")).toHaveLength(2);
  });
});

describe("entrées Fiscalité des mandants et Analytique de la navigation", () => {
  const finances = (options: { tax?: boolean; analytics?: boolean }) => buildNavigation(undefined, { rent: true, ...options }).sections.find((section) => section.id === "finances")?.entries ?? [];

  it("n'apparaissent qu'en mode api, après les comptes rendus", () => {
    expect(finances({}).map((entry) => entry.id)).not.toEqual(expect.arrayContaining(["fiscalite", "analytique"]));
    const ids = finances({ tax: true, analytics: true }).map((entry) => entry.id);
    expect(ids.indexOf("fiscalite")).toBe(ids.indexOf("comptes-rendus") + 1);
    expect(finances({ tax: true }).find((entry) => entry.id === "fiscalite")?.href).toBe("/finances/fiscalite");
    expect(finances({ analytics: true }).find((entry) => entry.id === "analytique")?.href).toBe("/analytique");
  });

  it("ne les expose à la recherche qu'en mode api", () => {
    expect(buildSearchPages().some((page) => page.href === "/finances/fiscalite" || page.href === "/analytique")).toBe(false);
    expect(buildSearchPages({ records: false }).filter((page) => ["/finances/fiscalite", "/analytique", "/analytique/revenus-depenses", "/analytique/occupation"].includes(page.href))).toHaveLength(4);
  });
});

describe("entrées Dépenses et Régularisation des charges de la navigation", () => {
  const finances = (charges: boolean) => buildNavigation(undefined, { rent: true, charges }).sections.find((section) => section.id === "finances")?.entries ?? [];

  it("n'apparaissent qu'en mode api, avant les comptes rendus", () => {
    expect(finances(false).map((entry) => entry.id)).not.toContain("depenses");
    expect(finances(false).map((entry) => entry.id)).not.toContain("charges");
    const ids = finances(true).map((entry) => entry.id);
    expect(ids.indexOf("depenses")).toBe(ids.indexOf("comptes-rendus") - 2);
    expect(finances(true).find((entry) => entry.id === "depenses")?.href).toBe("/finances/depenses");
    expect(finances(true).find((entry) => entry.id === "charges")?.href).toBe("/finances/charges");
  });

  it("ne les expose à la recherche qu'en mode api", () => {
    const hrefs = ["/finances/depenses", "/finances/depenses/nouvelle", "/finances/charges", "/finances/charges/nouveau", "/finances/charges/cles"];
    expect(buildSearchPages().filter((page) => hrefs.includes(page.href))).toHaveLength(0);
    expect(buildSearchPages({ records: false }).filter((page) => hrefs.includes(page.href)).map((page) => page.href).sort()).toEqual([...hrefs].sort());
  });
});

describe("recherche des changements d'IBAN", () => {
  const demandes = (options?: { records: boolean }) => buildSearchPages(options).filter((page) => page.href === "/finances/reversements/demandes-iban");

  it("n'est exposée qu'en mode api", () => {
    expect(demandes()).toHaveLength(0);
    expect(demandes({ records: false })).toHaveLength(1);
  });
});

describe("entrée Impayés de la navigation", () => {
  const impayes = (rent: boolean) => buildNavigation(undefined, { rent }).sections.flatMap((section) => section.entries).find((entry) => entry.id === "impayes");

  it("reste active sur les dossiers de recouvrement, dans les deux modes, sans ajouter d'entrée", () => {
    for (const rent of [false, true]) {
      expect(impayes(rent)?.href).toBe("/finances/impayes");
      expect(impayes(rent)?.activeFor).toEqual(["/finances/recouvrement"]);
    }
    expect(buildNavigation(undefined, { rent: false }).sections.flatMap((section) => section.entries)).toHaveLength(16);
  });

  it("n'expose les dossiers à la recherche qu'en mode api", () => {
    expect(buildSearchPages().some((page) => page.href === "/finances/recouvrement")).toBe(false);
    expect(buildSearchPages({ records: false }).some((page) => page.href === "/finances/recouvrement")).toBe(true);
  });
});

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

  const apiOnly = new Set(apiOnlyPages.map(([href]) => href));
  const routes = ["/", ...staticRoutes(join(process.cwd(), "src/app/(espace)"))];

  it("propose chaque page statique de l'espace de démonstration", () => {
    expect(routes.length).toBeGreaterThan(30);
    const banking = routes.filter((candidate) => candidate.startsWith("/finances/banque"));
    for (const route of routes.filter((candidate) => !apiOnly.has(candidate) && !banking.includes(candidate))) expect(hrefs.has(route), route).toBe(true);
    for (const href of [...apiOnly, ...banking]) expect(hrefs.has(href), href).toBe(false);
  });

  it("propose en mode api chaque page statique, sans aucune fiche de démonstration", () => {
    const pages = buildSearchPages({ records: false, banking: true, tenantRequests: { manage: true, payments: true } });
    const apiHrefs = new Set(pages.map((page) => page.href));
    for (const route of routes) expect(apiHrefs.has(route), route).toBe(true);
    expect(pages.some((page) => /^(Mandant|Lot|Locataire), /.test(page.label))).toBe(false);
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

describe("navigation du support en mode api", () => {
  const footer = (support?: SupportNavigation) => buildNavigation(undefined, { rent: true, ...(support ? { support } : {}) }).footer;

  it("n'ajoute rien hors mode api", () => {
    expect(footer().map((entry) => entry.id)).toEqual(["reglages", "equipe"]);
    expect(footer()[0]?.children).toBeUndefined();
  });

  it("ajoute l'entrée Support avec le nombre de réponses à lire, pour tous les rôles", () => {
    const entries = footer({ manageAccess: false, requests: 2 });

    expect(entries.map((entry) => entry.id)).toEqual(["reglages", "equipe", "support"]);
    expect(entries.find((entry) => entry.id === "support")).toMatchObject({ href: "/support", count: 2 });
    expect(entries[0]?.children).toBeUndefined();
  });

  it("ne montre les accès du support qu'au propriétaire et aux administrateurs, avec le nombre en attente", () => {
    const settings = footer({ manageAccess: true, access: 3 })[0];

    expect(settings?.count).toBe(3);
    expect(settings?.children?.map((child) => child.href)).toEqual(["/reglages", "/reglages/acces-support"]);
  });

  it("n'affiche aucun compteur à zéro ou inconnu", () => {
    const entries = footer({ manageAccess: true, requests: 0, access: undefined });

    expect(entries.find((entry) => entry.id === "support")?.count).toBeUndefined();
    expect(entries[0]?.count).toBeUndefined();
  });

  it("propose les pages du support à la recherche en mode api seulement", () => {
    expect(buildSearchPages({ records: false }).map((page) => page.href)).toEqual(expect.arrayContaining(["/support", "/support/nouvelle", "/reglages/acces-support"]));
    expect(buildSearchPages().map((page) => page.href)).not.toContain("/support");
  });
});

describe("navigation de l'agenda, des contacts et du journal", () => {
  const ids = (options: Parameters<typeof buildNavigation>[1]) => {
    const navigation = buildNavigation(undefined, options);
    return [...navigation.sections.flatMap((section) => section.entries), ...navigation.footer].map((entry) => entry.id);
  };

  it("n'expose rien en mode démonstration", () => {
    expect(ids({ rent: false })).not.toEqual(expect.arrayContaining(["agenda", "taches", "contacts", "journal"]));
  });

  it("expose l'agenda, les tâches et les contacts en mode api", () => {
    expect(ids({ rent: true, planning: true, contacts: true })).toEqual(expect.arrayContaining(["agenda", "taches", "contacts"]));
  });

  it("réserve le journal et le fuseau à l'option activée pour le titulaire et l'administrateur", () => {
    expect(ids({ rent: true, planning: true })).not.toContain("journal");
    expect(ids({ rent: true, activity: true })).toContain("journal");
    const settings = buildNavigation(undefined, { rent: true, timezone: true }).footer.find((entry) => entry.id === "reglages");
    expect(settings?.children?.map((child) => child.href)).toEqual(["/reglages", "/reglages/fuseau-horaire"]);
  });

  it("propose ces pages à la recherche en mode api seulement", () => {
    expect(buildSearchPages({ records: false }).map((page) => page.href)).toEqual(expect.arrayContaining(["/agenda", "/taches", "/contacts", "/journal", "/reglages/fuseau-horaire"]));
    expect(buildSearchPages().map((page) => page.href)).not.toContain("/agenda");
  });
});
