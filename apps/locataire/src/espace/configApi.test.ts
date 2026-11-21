import { helpCenterSchema } from "@eguardimmo/messagerie";
import { activeChildHref, isEntryActive } from "@eguardimmo/ui";
import { describe, expect, it } from "vitest";
import { pageFiles } from "../../test/pages";
import { apiHelpCenter, apiLocataireProfile } from "./aide";
import { classifyRoute, unavailableFamilyOf } from "./capabilities";
import { apiAccountMenu, apiBottomItems, apiNavigation, apiSearchPages, withAnnouncementCount, withMessageCount, withSupportCount } from "./configApi";

const entries = [...apiNavigation.sections.flatMap((section) => section.entries), ...apiNavigation.footer];
const pageRoutes = new Set(pageFiles().map((page) => page.route.replace(/\/x$/, "")));

describe("navigation de l’espace locataire en mode api", () => {
  it("chaque lien mène à une page existante classée", () => {
    const hrefs = [
      ...entries.map((entry) => entry.href),
      ...entries.flatMap((entry) => (entry.children ?? []).map((child) => child.href)),
      ...apiBottomItems.map((item) => item.href),
      ...apiAccountMenu.groups.flatMap((group) => group.items.map((item) => item.href)),
      ...apiSearchPages.map((page) => page.href),
    ];
    for (const href of hrefs) {
      expect(pageRoutes.has(href), href).toBe(true);
      expect(classifyRoute(href), href).not.toBeNull();
    }
  });

  it("la barre mobile, le menu du compte et la recherche ne proposent que des écrans réels", () => {
    const hrefs = [
      ...apiBottomItems.map((item) => item.href),
      ...apiAccountMenu.groups.flatMap((group) => group.items.map((item) => item.href)),
      ...apiSearchPages.map((page) => page.href),
    ];
    for (const href of hrefs) expect(unavailableFamilyOf(href), href).toBeNull();
  });

  it("la barre mobile reprend des entrées de la navigation (mêmes id)", () => {
    const ids = new Set(entries.map((entry) => entry.id));
    for (const item of apiBottomItems) expect(ids.has(item.id), item.id).toBe(true);
  });

  it("les identifiants de navigation sont uniques et le menu du compte garde l’authentification", () => {
    const ids = entries.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(apiAccountMenu.switchSpace?.href).toBe("http://localhost:3040/profils");
    expect(apiAccountMenu.signOut.href).toBe("http://localhost:3040/deconnecte");
  });

  it("ne mentionne plus l’accueil ni le bail de démonstration", () => {
    expect(entries.map((entry) => entry.label)).not.toContain("Accueil");
    expect(entries.map((entry) => entry.label)).not.toContain("Mon bail");
  });
});

describe("entrées de loyers de la navigation en mode api", () => {
  const loyers = entries.find((entry) => entry.id === "loyers");
  const children = loyers?.children ?? [];

  it("regroupe loyers, quittances, paiements et régularisation sous une entrée dont le premier enfant est le lien de l’entrée", () => {
    expect(children.map((child) => child.href)).toEqual(["/loyers", "/loyers/quittances", "/loyers/paiements", "/loyers/regularisation"]);
    expect(children[0]?.href).toBe(loyers?.href);
    const ids = [...entries.map((entry) => entry.id), ...entries.flatMap((entry) => (entry.children ?? []).map((child) => child.id))];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each([
    ["/loyers", "/loyers"],
    ["/loyers/echeances/0193a5e1-0000-7000-8000-000000000001", "/loyers"],
    ["/loyers/quittances", "/loyers/quittances"],
    ["/loyers/quittances/0193a5e1-0000-7000-8000-000000000001", "/loyers/quittances"],
    ["/loyers/paiements/0193a5e1-0000-7000-8000-000000000001", "/loyers/paiements"],
    ["/loyers/regularisation", "/loyers/regularisation"],
    ["/loyers/regularisation/0193a5e1-0000-7000-8000-000000000001", "/loyers/regularisation"],
  ])("%s met en évidence %s et lui seul", (path, active) => {
    expect(loyers && isEntryActive(loyers, path)).toBe(true);
    expect(activeChildHref(children, path)).toBe(active);
  });

  it("n’active pas l’entrée sur une autre section", () => {
    expect(loyers && isEntryActive(loyers, "/bail")).toBe(false);
  });

  it("garde la démonstration inchangée : une seule entrée Loyers et quittances sans enfant", async () => {
    const { buildNavigation } = await import("./config");
    const demo = buildNavigation().sections.flatMap((section) => section.entries);

    expect(demo.filter((entry) => entry.href.startsWith("/loyers"))).toHaveLength(1);
    expect(demo.find((entry) => entry.id === "loyers")?.children).toBeUndefined();
    expect(demo.find((entry) => entry.id === "loyers")?.label).toBe("Loyers et quittances");
    expect(demo.map((entry) => entry.id)).toEqual(["accueil", "bail", "loyers", "etats-des-lieux", "documents", "messages", "interventions", "assurance"]);
  });

  it("propose les loyers dans la barre mobile et la recherche", () => {
    expect(apiBottomItems.map((item) => item.href)).toContain("/loyers");
    expect(apiSearchPages.map((page) => page.href)).toEqual(expect.arrayContaining(["/loyers", "/loyers/quittances", "/loyers/paiements", "/loyers/regularisation"]));
  });
});

describe("aide du locataire en mode api", () => {
  it("respecte le contrat de la messagerie", () => {
    expect(helpCenterSchema.safeParse(apiHelpCenter).success).toBe(true);
  });

  it("ne renvoie que vers des écrans réels et ne promet aucune fonction absente", () => {
    const links = apiHelpCenter.categories.flatMap((category) => category.articles.flatMap((article) => (article.href ? [article.href] : [])));
    expect(links.length).toBeGreaterThan(0);
    for (const href of links) expect(unavailableFamilyOf(href), href).toBeNull();
    const text = JSON.stringify(apiHelpCenter);
    for (const forbidden of ["Tilleuls", "01 00 00", "gestion@example.com", "31/03/2027", "Signaler un problème"]) expect(text).not.toContain(forbidden);
  });

  it("n’invite pas à écrire au gestionnaire", () => {
    expect(apiLocataireProfile.help.writeLabel).toBeNull();
    expect(apiLocataireProfile.help.supportTicket).toBe(true);
  });
});

describe("compteur de messages non lus de la navigation", () => {
  const countOf = (unread: number | undefined) =>
    withMessageCount(apiNavigation, unread).sections.flatMap((section) => section.entries).find((entry) => entry.id === "messages")?.count;

  it("porte le total servi sur l’entrée Messages uniquement", () => {
    const counted = withMessageCount(apiNavigation, 4).sections.flatMap((section) => section.entries).filter((entry) => entry.count !== undefined);

    expect(counted.map((entry) => entry.id)).toEqual(["messages"]);
    expect(countOf(4)).toBe(4);
  });

  it("n’affiche aucun compteur tant que le total n’est pas connu", () => {
    expect(countOf(undefined)).toBeUndefined();
  });
});

describe("compteur de réponses du support de la navigation", () => {
  const countOf = (unread: number | undefined) =>
    withSupportCount(apiNavigation, unread).sections.flatMap((section) => section.entries).find((entry) => entry.id === "support")?.count;

  it("porte le nombre de réponses à lire sur l’entrée Support uniquement", () => {
    const counted = withSupportCount(apiNavigation, 2).sections.flatMap((section) => section.entries).filter((entry) => entry.count !== undefined);

    expect(counted.map((entry) => entry.id)).toEqual(["support"]);
    expect(countOf(2)).toBe(2);
  });

  it("n’affiche aucun compteur tant que le nombre n’est pas connu", () => {
    expect(countOf(undefined)).toBeUndefined();
  });

  it("propose l’entrée Support et la recherche d’une demande", () => {
    expect(entries.find((entry) => entry.id === "support")?.href).toBe("/support");
    expect(apiSearchPages.map((page) => page.href)).toContain("/support");
  });
});

describe("annonces dans la navigation du locataire en mode api", () => {
  it("propose l'entrée Annonces vers un écran réel, avec un compteur sur cette entrée seule", () => {
    const annonces = entries.find((entry) => entry.id === "annonces");
    expect(annonces?.href).toBe("/annonces");
    expect(unavailableFamilyOf("/annonces")).toBeNull();
    expect(apiSearchPages.map((page) => page.href)).toContain("/annonces");
    const counted = withAnnouncementCount(apiNavigation, 3).sections.flatMap((section) => section.entries).filter((entry) => entry.count !== undefined);
    expect(counted.map((entry) => [entry.id, entry.count])).toEqual([["annonces", 3]]);
  });

  it("n'affiche aucun compteur tant que le total n'est pas connu", () => {
    expect(withAnnouncementCount(apiNavigation, undefined)).toBe(apiNavigation);
  });

  it("ne propose pas les annonces dans la démonstration", async () => {
    const { buildNavigation } = await import("./config");
    expect(buildNavigation().sections.flatMap((section) => section.entries).some((entry) => entry.id === "annonces")).toBe(false);
  });
});
