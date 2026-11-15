import { SupportWidget } from "@eguardimmo/messagerie";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../../../test/axe";
import { MessagerieSpaceProvider } from "./SpaceProvider";
import type { MessagerieSpaceName } from "./SpaceProvider";
import { confieHref } from "./routes";
import { firstOf, flowNavigation, renderFlow } from "./testing";

vi.mock("next/link", async () => ({ default: (await import("./testing")).FlowLink }));
vi.mock("next/navigation", async () => {
  const { flowNavigation: navigation } = await import("./testing");
  return {
    useRouter: () => ({ push: (href: string) => { navigation.push(href); }, replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
    usePathname: () => "/",
    useSearchParams: () => new URLSearchParams(),
  };
});

interface SpaceCase {
  label: string;
  space: MessagerieSpaceName;
  prefix: string;
  pickRecipient: boolean;
}

const bailleurCase: SpaceCase = { label: "espace bailleur", space: "bailleur", prefix: "", pickRecipient: true };
const mandantCase: SpaceCase = { label: "espace mandant", space: "proprietaire", prefix: "/confie", pickRecipient: false };

function setup({ space, prefix }: SpaceCase, start: string) {
  return renderFlow({
    prefix,
    start: `${prefix}${start}`,
    wrap: (children) => (
      <MessagerieSpaceProvider space={space}>
        {children}
        <SupportWidget />
      </MessagerieSpaceProvider>
    ),
  });
}

beforeEach(() => {
  flowNavigation.push = () => undefined;
});

describe.each([bailleurCase, mandantCase])("messagerie, $label", (spaceCase) => {
  const { prefix, pickRecipient } = spaceCase;

  it("parcourt la liste, la conversation, une réponse puis un nouveau message", async () => {
    const { container } = setup(spaceCase, "/messages");
    const list = await screen.findByRole("list", { name: "Conversations" });
    await expectNoA11yViolations(container);

    const first = firstOf(within(list).getAllByRole("link"));
    expect(first.getAttribute("href")?.startsWith(`${prefix}/messages/`)).toBe(true);
    await userEvent.click(first);
    const thread = await screen.findByRole("list", { name: "Fil de la conversation" });
    const before = thread.querySelectorAll("article").length;

    await userEvent.type(screen.getByRole("textbox", { name: "Votre réponse" }), "Bien reçu, merci.");
    await userEvent.click(screen.getByRole("button", { name: "Envoyer" }));
    expect(await screen.findByText("Bien reçu, merci.")).toBeTruthy();
    expect(screen.getByRole("list", { name: "Fil de la conversation" }).querySelectorAll("article")).toHaveLength(before + 1);
    await expectNoA11yViolations(container);

    expect(screen.getByRole("link", { name: "Messages" }).getAttribute("href")).toBe(`${prefix}/messages`);
    await userEvent.click(screen.getByRole("link", { name: "Messages" }));
    await userEvent.click(await screen.findByRole("link", { name: "Nouveau message" }));
    expect(screen.getByRole("link", { name: "Messages" }).getAttribute("href")).toBe(`${prefix}/messages`);
    expect(await screen.findByRole("form", { name: "Nouveau message" })).toBeTruthy();
    await expectNoA11yViolations(container);

    if (pickRecipient) {
      await userEvent.click(await screen.findByRole("combobox", { name: /Destinataire/ }));
      await userEvent.click(firstOf(await screen.findAllByRole("option")));
    }
    await userEvent.type(await screen.findByRole("textbox", { name: "Sujet" }), "Point sur le dossier");
    await userEvent.type(screen.getByRole("textbox", { name: "Message" }), "Pouvez-vous me rappeler demain ?");
    await userEvent.click(screen.getByRole("button", { name: "Envoyer" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Point sur le dossier" })).toBeTruthy();
    expect(screen.getByText("Pouvez-vous me rappeler demain ?")).toBeTruthy();
  });

  it("valide le nouveau message avant envoi", async () => {
    setup(spaceCase, "/messages/nouveau");
    await userEvent.click(await screen.findByRole("button", { name: "Envoyer" }));
    expect(await screen.findByText("Saisissez un sujet")).toBeTruthy();
    expect(screen.getByText("Saisissez votre message")).toBeTruthy();
  });

  it("affiche le centre d’aide sans violation d’accessibilité", async () => {
    const { container } = setup(spaceCase, "/aide");
    expect((await screen.findAllByRole("heading", { level: 2 })).length).toBeGreaterThan(0);
    await expectNoA11yViolations(container);
  });

  it("ouvre la bulle d'aide avec un lien vers le centre d'aide de l'espace", async () => {
    setup(spaceCase, "/messages");
    await userEvent.click(screen.getByRole("button", { name: "Aide et support" }));
    const panel = await screen.findByRole("dialog", { name: "Aide et support" });
    await waitFor(() => {
      expect(within(panel).getByRole("link", { name: "Ouvrir le centre d’aide" }).getAttribute("href")).toBe(`${prefix}/aide`);
    });
  });
});

describe("campagnes de l'espace bailleur", () => {

  it("liste les campagnes, ouvre la création puis revient à la liste", async () => {
    const { container } = setup(bailleurCase, "/messages");
    await userEvent.click(await screen.findByRole("link", { name: "Campagnes" }));
    const list = await screen.findByRole("list", { name: "Campagnes" });
    expect(within(list).getAllByRole("listitem").length).toBeGreaterThan(0);
    await expectNoA11yViolations(container);

    await userEvent.click(screen.getByRole("link", { name: "Nouvelle campagne" }));
    const form = await screen.findByRole("form", { name: "Nouvelle campagne" });
    await userEvent.click(firstOf(within(form).getAllByRole("radio")));
    await userEvent.type(within(form).getByRole("textbox", { name: "Objet" }), "Coupure d’eau");
    await userEvent.type(within(form).getByRole("textbox", { name: "Message" }), "Coupure lundi de 9 h à 12 h.");
    await userEvent.click(within(form).getByRole("button", { name: "Envoyer" }));
    expect(await screen.findByText("Campagne envoyée")).toBeTruthy();

    await userEvent.click(screen.getByRole("link", { name: "Retour aux campagnes" }));
    expect(await screen.findByText("Coupure d’eau")).toBeTruthy();
  });

  it("rouvre un brouillon depuis la liste", async () => {
    setup(bailleurCase, "/campagnes");
    const resume = await screen.findAllByRole("link", { name: /^(Reprendre|Modifier) / });
    expect(firstOf(resume).getAttribute("href")).toMatch(/^\/campagnes\/[\w-]+\/modifier$/);
    await userEvent.click(firstOf(resume));
    expect(await screen.findByRole("heading", { level: 1, name: "Modifier la campagne" })).toBeTruthy();
  });
});

describe("liens de l'espace mandant", () => {
  it("préfixe les liens internes par /confie sans doubler le préfixe", () => {
    expect(confieHref("/fiscalite")).toBe("/confie/fiscalite");
    expect(confieHref("/confie/messages")).toBe("/confie/messages");
    expect(confieHref("/confie")).toBe("/confie");
  });

  it("n'expose pas les campagnes dans l'espace mandant", async () => {
    setup(mandantCase, "/messages");
    await screen.findByRole("list", { name: "Conversations" });
    expect(screen.queryByRole("link", { name: "Campagnes" })).toBeNull();
  });
});
