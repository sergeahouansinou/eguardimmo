import { SupportWidget, demoSeeds } from "@eguardimmo/messagerie";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Providers } from "@/app/providers";
import { expectNoA11yViolations } from "../../test/axe";
import { firstOf, flowNavigation, renderFlow } from "../../test/flow";
import { demoShell } from "./demo";

vi.mock("next/link", async () => ({ default: (await import("../../test/flow")).FlowLink }));
vi.mock("next/navigation", async () => {
  const { flowNavigation: navigation } = await import("../../test/flow");
  return {
    useRouter: () => ({ push: (href: string) => { navigation.push(href); }, replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
    usePathname: () => "/",
    useSearchParams: () => new URLSearchParams(),
  };
});

function setup(start: string) {
  return renderFlow({
    start,
    wrap: (children) => (
      <Providers>
        {children}
        <SupportWidget />
      </Providers>
    ),
  });
}

beforeEach(() => {
  flowNavigation.push = () => undefined;
});

describe("messagerie de l'espace agence", () => {
  it("parcourt la liste, la conversation, une réponse puis un nouveau message", async () => {
    const { container } = setup("/messages");
    expect(await screen.findByRole("region", { name: "Messages non lus" })).toBeTruthy();
    const list = await screen.findByRole("list", { name: "Conversations" });
    await expectNoA11yViolations(container);

    const first = firstOf(within(list).getAllByRole("link"));
    expect(first.getAttribute("href")?.startsWith("/messages/")).toBe(true);
    await userEvent.click(first);
    const thread = await screen.findByRole("list", { name: "Fil de la conversation" });
    const before = thread.querySelectorAll("article").length;

    await userEvent.type(screen.getByRole("textbox", { name: "Votre réponse" }), "Bien reçu, nous revenons vers vous.");
    await userEvent.click(screen.getByRole("button", { name: "Envoyer" }));
    expect(await screen.findByText("Bien reçu, nous revenons vers vous.")).toBeTruthy();
    expect(screen.getByRole("list", { name: "Fil de la conversation" }).querySelectorAll("article")).toHaveLength(before + 1);
    await expectNoA11yViolations(container);

    await userEvent.click(screen.getByRole("link", { name: "Messages" }));
    await userEvent.click(await screen.findByRole("link", { name: "Nouveau message" }));
    expect(await screen.findByRole("form", { name: "Nouveau message" })).toBeTruthy();
    await expectNoA11yViolations(container);

    await userEvent.click(await screen.findByRole("combobox", { name: /Destinataire/ }));
    await userEvent.click(firstOf(await screen.findAllByRole("option")));
    await userEvent.type(screen.getByRole("textbox", { name: "Sujet" }), "Devis plomberie");
    await userEvent.type(screen.getByRole("textbox", { name: "Message" }), "Le devis est joint pour accord.");
    await userEvent.click(screen.getByRole("button", { name: "Envoyer" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Devis plomberie" })).toBeTruthy();
    expect(screen.getByText("Le devis est joint pour accord.")).toBeTruthy();
  });

  it("valide le nouveau message avant envoi", async () => {
    setup("/messages/nouveau");
    await userEvent.click(await screen.findByRole("button", { name: "Envoyer" }));
    expect(await screen.findByText("Choisissez un destinataire")).toBeTruthy();
    expect(screen.getByText("Saisissez un sujet")).toBeTruthy();
  });

  it("liste les campagnes, ouvre la création puis revient à la liste", async () => {
    const { container } = setup("/messages");
    await userEvent.click(await screen.findByRole("link", { name: "Campagnes" }));
    const list = await screen.findByRole("list", { name: "Campagnes" });
    expect(within(list).getAllByRole("listitem").length).toBeGreaterThan(0);
    await expectNoA11yViolations(container);

    await userEvent.click(screen.getByRole("link", { name: "Nouvelle campagne" }));
    const form = await screen.findByRole("form", { name: "Nouvelle campagne" });
    await userEvent.click(firstOf(within(form).getAllByRole("radio")));
    await userEvent.type(within(form).getByRole("textbox", { name: "Objet" }), "Ramonage annuel");
    await userEvent.type(within(form).getByRole("textbox", { name: "Message" }), "Le ramoneur passe en décembre.");
    await userEvent.click(within(form).getByRole("button", { name: "Envoyer" }));
    expect(await screen.findByText("Campagne envoyée")).toBeTruthy();

    await userEvent.click(screen.getByRole("link", { name: "Retour aux campagnes" }));
    expect(await screen.findByText("Ramonage annuel")).toBeTruthy();
  });

  it("rouvre un brouillon depuis la liste des campagnes", async () => {
    setup("/campagnes");
    const resume = await screen.findAllByRole("link", { name: /^(Reprendre|Modifier) / });
    expect(firstOf(resume).getAttribute("href")).toMatch(/^\/campagnes\/[\w-]+\/modifier$/);
    await userEvent.click(firstOf(resume));
    expect(await screen.findByRole("heading", { level: 1, name: "Modifier la campagne" })).toBeTruthy();
  });

  it("affiche le centre d'aide sans violation d'accessibilité", async () => {
    const { container } = setup("/aide");
    expect((await screen.findAllByRole("heading", { level: 2 })).length).toBeGreaterThan(0);
    await expectNoA11yViolations(container);
  });

  it("ouvre la bulle d'aide avec un lien vers le centre d'aide", async () => {
    setup("/messages");
    await userEvent.click(screen.getByRole("button", { name: "Aide et support" }));
    const panel = await screen.findByRole("dialog", { name: "Aide et support" });
    await waitFor(() => {
      expect(within(panel).getByRole("link", { name: "Ouvrir le centre d’aide" }).getAttribute("href")).toBe("/aide");
    });
  });

  it("garde le compteur de la coquille aligné sur les messages non lus de la démonstration", () => {
    const unread = demoSeeds.agence().conversations.filter((conversation) => conversation.unread && !conversation.archived).length;
    expect(demoShell.counts.messages).toBe(unread);
  });
});
