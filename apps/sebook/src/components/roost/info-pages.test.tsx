import { screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import AccessibilitePage from "@/app/accessibilite/page";
import AidePage from "@/app/aide/page";
import AnnulationPage from "@/app/annulation/page";
import AntiDiscriminationPage from "@/app/anti-discrimination/page";
import CarrieresPage from "@/app/carrieres/page";
import ConditionsPage from "@/app/conditions/page";
import ConfidentialitePage from "@/app/confidentialite/page";
import ConformitePage from "@/app/conformite/page";
import ContactPage from "@/app/contact/page";
import PressePage from "@/app/presse/page";
import RessourcesPage from "@/app/ressources/page";
import SecuritePage from "@/app/securite/page";
import SignalementPage from "@/app/signalement/page";
import { INFO_PATHS } from "@/lib/seo";
import { AUTH_URL, renderApp, stubApi } from "../../../test/api";
import { expectNoA11yViolations } from "../../../test/axe";

vi.mock("@/components/roost/Header", () => ({ default: () => <header aria-label="En-tête" /> }));

const PAGES: [string, () => ReactElement][] = [
  ["/aide", AidePage],
  ["/conditions", ConditionsPage],
  ["/confidentialite", ConfidentialitePage],
  ["/annulation", AnnulationPage],
  ["/securite", SecuritePage],
  ["/accessibilite", AccessibilitePage],
  ["/contact", ContactPage],
  ["/signalement", SignalementPage],
  ["/ressources", RessourcesPage],
  ["/presse", PressePage],
  ["/carrieres", CarrieresPage],
  ["/anti-discrimination", AntiDiscriminationPage],
  ["/conformite", ConformitePage],
];

const KNOWN_ROUTES = new Set(["/", "/destinations", "/favorites", "/compte", ...INFO_PATHS]);
const FORBIDDEN = [/eGuardImmo/i, /paiement sur place/i, /messagerie/i, /Europe/, /Afrique/, /gestion-immobiliere/, /devenir-hote/, /parrainage/, /a-propos/];

describe("pages d’information", () => {
  it("couvre exactement les 13 routes publiées au plan du site", () => {
    expect(PAGES.map(([path]) => path).sort()).toEqual([...INFO_PATHS].sort());
  });

  describe.each(PAGES)("%s", (path, Page) => {
    it("affiche un titre, un pied de page et aucune violation d’accessibilité", async () => {
      stubApi();
      const { container } = renderApp(<Page />, { pathname: path });
      expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
      expect(screen.getByRole("main")).toBeTruthy();
      expect(screen.getByRole("contentinfo")).toBeTruthy();
      await expectNoA11yViolations(container);
    });

    it("ne contient aucun lien mort ni reste de l’ancienne plateforme", () => {
      stubApi();
      const { container } = renderApp(<Page />, { pathname: path });
      for (const link of container.querySelectorAll("a")) {
        const href = link.getAttribute("href") ?? "";
        if (href.startsWith("/")) expect(KNOWN_ROUTES.has(new URL(href, "http://x").pathname), href).toBe(true);
        else expect(href.startsWith(AUTH_URL), href).toBe(true);
      }
      const text = container.textContent;
      for (const pattern of FORBIDDEN) expect(text).not.toMatch(pattern);
    });

    it("sérialise un JSON-LD valide avec fil d’Ariane", () => {
      stubApi();
      const { container } = renderApp(<Page />, { pathname: path });
      const scripts = [...container.querySelectorAll('script[type="application/ld+json"]')];
      const nodes = scripts.map((script) => JSON.parse(script.textContent) as { "@type": string });
      expect(nodes.map((node) => node["@type"])).toEqual(expect.arrayContaining(["WebPage", "BreadcrumbList"]));
      for (const script of scripts) expect(script.textContent).not.toContain("<");
    });
  });

  it("ouvre une question de la FAQ au clic et la referme", async () => {
    stubApi();
    const { user, container } = renderApp(<AidePage />, { pathname: "/aide" });
    const details = container.querySelector("details");
    if (!details) throw new Error("FAQ absente");
    const summary = within(details).getByText("Comment réserver un logement sur SeBook ?");
    expect(details.open).toBe(false);
    await user.click(summary);
    expect(details.open).toBe(true);
    expect(within(details).getByText(/Paiement à finaliser/)).toBeTruthy();
    await user.click(summary);
    expect(details.open).toBe(false);
  });

  it("reprend les politiques d’annulation du contrat réel", () => {
    stubApi();
    renderApp(<AnnulationPage />, { pathname: "/annulation" });
    expect(screen.getByText("Remboursement intégral jusqu’à 1 jour avant l’arrivée.")).toBeTruthy();
    expect(screen.getByText("Remboursement intégral jusqu’à 5 jours avant l’arrivée.")).toBeTruthy();
    expect(screen.getByText("Remboursement de 50 % jusqu’à 7 jours avant l’arrivée.")).toBeTruthy();
  });

  it("signale en [À RENSEIGNER] ce qui n’est pas vérifiable et l’exclut du JSON-LD", () => {
    stubApi();
    const { container } = renderApp(<SignalementPage />, { pathname: "/signalement" });
    expect(container.querySelectorAll("mark").length).toBeGreaterThan(0);
    const faq = [...container.querySelectorAll('script[type="application/ld+json"]')]
      .map((script) => JSON.parse(script.textContent) as { "@type": string; mainEntity?: { name: string }[] })
      .find((node) => node["@type"] === "FAQPage");
    expect(faq?.mainEntity?.map((entry) => entry.name)).toEqual(["Dois-je signaler même en cas de simple doute ?"]);
  });

  it("propose « Devenir hôte » vers l’espace d’authentification", () => {
    stubApi();
    renderApp(<RessourcesPage />, { pathname: "/ressources" });
    expect(screen.getByRole("link", { name: "Devenir hôte" }).getAttribute("href")).toBe(`${AUTH_URL}/inscription`);
  });
});
