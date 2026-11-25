import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "../../test/axe";
import { renderPage } from "../../test/render";
import { SITEMAP_PATHS } from "@/lib/routes";
import AgencesPage from "./agences/page";
import ConfidentialitePage from "./confidentialite/page";
import ContactPage from "./contact/page";
import FaqPage from "./faq/page";
import HomePage from "./page";
import LocatairesPage from "./locataires/page";
import MentionsLegalesPage from "./mentions-legales/page";
import NotFound from "./not-found";
import ProprietairesPage from "./proprietaires/page";
import TarifsPage from "./tarifs/page";

const PAGES: readonly [string, string, () => ReactElement][] = [
  ["accueil", "/", () => <HomePage />],
  ["agences", "/agences", () => <AgencesPage />],
  ["propriétaires", "/proprietaires", () => <ProprietairesPage />],
  ["locataires", "/locataires", () => <LocatairesPage />],
  ["tarifs", "/tarifs", () => <TarifsPage />],
  ["faq", "/faq", () => <FaqPage />],
  ["contact", "/contact", () => <ContactPage />],
  ["mentions légales", "/mentions-legales", () => <MentionsLegalesPage />],
  ["confidentialité", "/confidentialite", () => <ConfidentialitePage />],
];

describe("pages de la vitrine", () => {
  it.each(PAGES)("%s : un seul h1, aucune violation d’accessibilité, liens internes existants", async (_name, _path, page) => {
    const { container } = renderPage(page());
    expect(container.querySelectorAll("h1")).toHaveLength(1);
    await expectNoA11yViolations(container);

    const internal = Array.from(container.querySelectorAll("a[href^='/']"), (anchor) => anchor.getAttribute("href") ?? "");
    for (const href of internal) expect(SITEMAP_PATHS as readonly string[]).toContain(href);
  });

  it("couvre chaque page du plan du site", () => {
    expect(PAGES.map(([, path]) => path).sort()).toEqual([...SITEMAP_PATHS].sort());
  });

  it("l’accueil propose un onglet par profil et la page 404 un retour à l’accueil", () => {
    const home = renderPage(<HomePage />);
    expect(home.getAllByRole("tab")).toHaveLength(3);
    home.unmount();
    const missing = renderPage(<NotFound />);
    expect(missing.container.querySelectorAll("h1")).toHaveLength(1);
    expect(missing.getAllByRole("link", { name: "Revenir à l’accueil" })[0]?.getAttribute("href")).toBe("/");
  });

  it("tarifs : aucun montant inventé sans configuration", () => {
    const { container } = renderPage(<TarifsPage />);
    const main = container.querySelector("main");
    expect(main?.textContent).toContain("[À RENSEIGNER]");
    expect(main?.textContent).toContain("Sur devis");
    expect(main?.textContent).not.toMatch(/€|\$|\d+\s?(?:HT|TTC)/);
  });

  it.each([
    ["mentions légales", () => <MentionsLegalesPage />],
    ["confidentialité", () => <ConfidentialitePage />],
  ])("%s : contenu juridique à renseigner, aucun texte juridique inventé", (_name, page) => {
    const { container } = renderPage(page());
    const main = container.querySelector("main");
    expect(main?.querySelectorAll("dd").length).toBeGreaterThan(5);
    for (const value of main?.querySelectorAll("dd") ?? []) expect(value.textContent).toBe("[À RENSEIGNER]");
  });

  it("la page contact contient le formulaire de démonstration", () => {
    const { getByRole } = renderPage(<ContactPage />);
    expect(getByRole("form", { name: "Demande de démonstration" })).not.toBeNull();
  });
});
