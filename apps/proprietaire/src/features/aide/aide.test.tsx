import { demoSeeds } from "@eguardimmo/messagerie";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../../../test/axe";
import { MessagerieSpaceProvider } from "../messagerie/SpaceProvider";
import { flowNavigation, renderFlow } from "../messagerie/testing";
import { NouveautesPage } from "./NouveautesPage";
import { RaccourcisPage } from "./RaccourcisPage";
import { SignalerPage } from "./SignalerPage";
import { SupportPage } from "./SupportPage";
import { CHANGELOG } from "./changelog";
import { BUG_FIELDS, bugReportSchema, bugReportToTicket } from "./schemas";
import { SHORTCUT_GROUPS } from "./shortcuts";

vi.mock("next/link", async () => ({ default: (await import("../messagerie/testing")).FlowLink }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/aide",
  useSearchParams: () => new URLSearchParams(),
}));

function renderAide(page: () => ReactElement) {
  return renderFlow({
    prefix: "",
    start: "/aide",
    wrap: () => <MessagerieSpaceProvider space="bailleur">{page()}</MessagerieSpaceProvider>,
  });
}

beforeEach(() => {
  flowNavigation.push = () => undefined;
});

describe("raccourcis clavier", () => {
  it("liste les raccourcis réellement câblés, sans violation d'accessibilité", async () => {
    const { container } = renderAide(() => <RaccourcisPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Raccourcis clavier" })).toBeTruthy();
    expect(screen.getByText("Ouvrir la recherche de pages")).toBeTruthy();
    expect(screen.getByText("Afficher les raccourcis clavier")).toBeTruthy();
    expect(screen.getAllByRole("region")).toHaveLength(SHORTCUT_GROUPS.length);
    expect(container.querySelectorAll("kbd").length).toBeGreaterThan(10);
    expect(screen.getByRole("link", { name: "Centre d’aide" }).getAttribute("href")).toBe("/aide");
    await expectNoA11yViolations(container);
  });
});

describe("nouveautés", () => {
  it("liste les nouveautés de la plus récente à la plus ancienne et filtre par type", async () => {
    const { container } = renderAide(() => <NouveautesPage />);
    const list = screen.getByRole("list", { name: "Nouveautés" });
    const titles = within(list).getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    expect(titles[0]).toBe("Export de vos données");
    expect(titles).toHaveLength(CHANGELOG.length);
    expect(within(list).getByRole("link", { name: /Voir la page : Export de vos données/ }).getAttribute("href")).toBe("/compte/export");
    await expectNoA11yViolations(container);

    await userEvent.click(screen.getByRole("radio", { name: "Améliorations" }));
    const filtered = within(screen.getByRole("list", { name: "Nouveautés" })).getAllByRole("heading", { level: 2 });
    expect(filtered).toHaveLength(CHANGELOG.filter((entry) => entry.kind === "amelioration").length);
    await userEvent.click(screen.getByRole("radio", { name: "Correctifs" }));
    expect(screen.getByText("Aucune nouveauté de ce type pour le moment.")).toBeTruthy();
  });

  it("n'annonce aucune date postérieure à la date de démonstration", () => {
    expect(CHANGELOG.every((entry) => entry.date <= "2026-11-13")).toBe(true);
  });
});

describe("support", () => {
  it("affiche la disponibilité et les demandes passées, puis crée une demande", async () => {
    const { container } = renderAide(() => <SupportPage />);
    expect(await screen.findByRole("list", { name: "Mes demandes" })).toBeTruthy();
    expect(await screen.findByText(/Support (en ligne|hors ligne)/)).toBeTruthy();
    const before = within(screen.getByRole("list", { name: "Mes demandes" })).getAllByRole("listitem").length;
    await expectNoA11yViolations(container);

    await userEvent.type(screen.getByRole("textbox", { name: "Sujet" }), "Quittance de novembre manquante");
    await userEvent.type(screen.getByRole("textbox", { name: "Message" }), "La quittance de novembre n'apparaît pas.");
    await userEvent.click(screen.getByRole("button", { name: "Envoyer au support" }));
    expect(await screen.findByText("Demande envoyée")).toBeTruthy();
    expect(await screen.findByRole("button", { name: /Mes demandes/ })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /Mes demandes/ }));
    const after = await screen.findByRole("list", { name: "Mes demandes" });
    expect(within(after).getAllByRole("listitem").length).toBe(before + 1);
    expect(within(after).getByText("Quittance de novembre manquante")).toBeTruthy();
  });

  it("valide le formulaire avant l'envoi", async () => {
    renderAide(() => <SupportPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Envoyer au support" }));
    expect(await screen.findByText("Saisissez un sujet")).toBeTruthy();
    expect(screen.getByText("Saisissez votre message")).toBeTruthy();
  });
});

describe("signaler un problème", () => {
  it("refuse un signalement incomplet", async () => {
    renderAide(() => <SignalerPage />);
    await userEvent.click(screen.getByRole("button", { name: "Envoyer le signalement" }));
    expect(await screen.findByText("Résumez le problème en quelques mots")).toBeTruthy();
    expect(screen.getByText("Décrivez les étapes pour reproduire le problème")).toBeTruthy();
  });

  it("crée un ticket de support avec le contexte du signalement", async () => {
    const { container } = renderAide(() => <SignalerPage />);
    await expectNoA11yViolations(container);
    await userEvent.type(screen.getByRole("textbox", { name: "Résumé" }), "Le total des loyers est faux");
    await userEvent.type(screen.getByRole("textbox", { name: "Étapes pour reproduire" }), "Ouvrir Finances puis filtrer sur novembre.");
    await userEvent.click(screen.getByRole("button", { name: "Envoyer le signalement" }));
    const success = await screen.findByText(/Votre signalement porte la référence/);
    expect(success.textContent).toMatch(/[A-Z]+-\d+/);
    expect(screen.getByRole("link", { name: "Suivre mes demandes" }).getAttribute("href")).toBe("/aide/support");
    await waitFor(() => {
      expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Résumé" }).value).toBe("");
    });
  });

  it("compose un sujet préfixé et un corps structuré", () => {
    const report = bugReportSchema.parse({
      area: "finances",
      severity: "bloquant",
      summary: "Total faux",
      steps: "Ouvrir Finances et filtrer.",
      expected: "Le total des loyers encaissés.",
    });
    const ticket = bugReportToTicket(report);
    expect(ticket.subject).toBe("[Problème] Total faux");
    expect(ticket.body).toContain("Zone : Finances et loyers");
    expect(ticket.body).toContain("Résultat attendu :");
    expect(bugReportToTicket({ ...report, expected: "" }).body).not.toContain("Résultat attendu");
    expect(BUG_FIELDS).toHaveLength(5);
  });
});

describe("cohérence avec le centre d'aide", () => {
  it("les articles du centre d'aide renvoient vers les pages d'aide existantes", () => {
    const hrefs = demoSeeds
      .bailleur()
      .help.categories.flatMap((category) => category.articles.flatMap((article) => (article.href ? [article.href] : [])));
    expect(hrefs).toEqual(expect.arrayContaining(["/aide/raccourcis", "/aide/signaler"]));
  });
});
