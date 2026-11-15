import {
  ConversationPage,
  HelpPage,
  InboxPage,
  MessagerieProvider,
  NewMessagePage,
  createDemoMessagerieSource,
  locataireProfile,
  useSetConversationRead,
} from "@eguardimmo/messagerie";
import type { MessagerieSource } from "@eguardimmo/messagerie";
import { screen, waitFor, within } from "@testing-library/react";
import Link from "next/link";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { EspaceShell } from "@/app/(espace)/EspaceShell";
import { homeFixture } from "@/data/fixtures/compte";
import { messagerieRoutes } from "@/espace/messagerie";
import { expectNoA11yViolations } from "../../../test/axe";
import { nav } from "../../../test/navigation";
import { renderScreen } from "../../../test/render";

function withMessagerie(ui: ReactElement, source: MessagerieSource = createDemoMessagerieSource({ space: "locataire" })) {
  return (
    <MessagerieProvider
      source={source}
      profile={locataireProfile}
      routes={messagerieRoutes}
      Link={Link}
      navigate={(href) => { nav.push(href); }}
    >
      {ui}
    </MessagerieProvider>
  );
}

function MarkAsRead() {
  const { mutate } = useSetConversationRead();
  return <button type="button" onClick={() => { mutate({ id: "c-virement", read: true }); }}>Marquer lu</button>;
}

describe("Messagerie du locataire", () => {
  it("liste les conversations avec le lien vers un nouveau message", async () => {
    const { container } = renderScreen(withMessagerie(<InboxPage />), { pathname: "/messages" });
    expect(screen.getByRole("heading", { level: 1, name: "Messages" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Nouveau message" }).getAttribute("href")).toBe("/messages/nouveau");
    const list = await screen.findByRole("list", { name: "Conversations" });
    const link = within(list).getByRole("link", { name: /Merci de confirmer le virement/ });
    expect(link.getAttribute("href")).toBe("/messages/c-virement");
    await expectNoA11yViolations(container);
  });

  it("chaque message de l’accueil mène à une conversation existante", async () => {
    const source = createDemoMessagerieSource({ space: "locataire" });
    for (const message of homeFixture.messages) {
      const conversation = (await source.getConversation(message.id)) as { subject: string };
      expect(conversation.subject, message.id).toBe(message.title);
    }
  });

  it("parcourt liste, conversation, réponse puis nouveau message", async () => {
    const source = createDemoMessagerieSource({ space: "locataire" });
    const list = renderScreen(withMessagerie(<InboxPage />, source), { pathname: "/messages" });
    const href = (await screen.findByRole("link", { name: /Merci de confirmer le virement/ })).getAttribute("href");
    expect(href).toBe("/messages/c-virement");
    list.unmount();

    const thread = renderScreen(withMessagerie(<ConversationPage conversationId="c-virement" />, source), { pathname: href ?? "" });
    await screen.findByRole("list", { name: "Fil de la conversation" });
    expect(screen.getByRole("link", { name: "Messages" }).getAttribute("href")).toBe("/messages");
    await thread.user.type(screen.getByRole("textbox", { name: "Votre réponse" }), "Virement effectué ce matin.");
    await thread.user.click(screen.getByRole("button", { name: "Envoyer" }));
    expect(await screen.findByText("Virement effectué ce matin.")).toBeTruthy();
    thread.unmount();

    const compose = renderScreen(withMessagerie(<NewMessagePage />, source), { pathname: "/messages/nouveau" });
    await compose.user.type(await screen.findByRole("textbox", { name: "Sujet" }), "Attestation de loyer");
    await compose.user.type(screen.getByRole("textbox", { name: "Message" }), "Pouvez-vous m’envoyer une attestation ?");
    await compose.user.click(screen.getByRole("button", { name: "Envoyer" }));
    await waitFor(() => { expect(nav.push).toHaveBeenCalledOnce(); });
    expect(nav.push.mock.calls[0]?.[0]).toMatch(/^\/messages\/.+/);
  });

  it("affiche le centre d’aide sans violation d’accessibilité", async () => {
    const { container } = renderScreen(withMessagerie(<HelpPage />), { pathname: "/aide" });
    expect(await screen.findByRole("heading", { level: 2, name: "Questions fréquentes" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Écrire un message" }).getAttribute("href")).toBe("/messages/nouveau");
    await expectNoA11yViolations(container);
  });

  it("la coquille suit les messages non lus et monte le widget de support", async () => {
    const { user } = renderScreen(withMessagerie(<EspaceShell><MarkAsRead /></EspaceShell>), { pathname: "/messages" });
    const messagesLink = async () => (await screen.findAllByRole("link", { name: /^Messages/ }))[0];
    await waitFor(async () => { expect((await messagesLink())?.textContent).toBe("Messages1"); });
    await user.click(screen.getByRole("button", { name: "Marquer lu" }));
    await waitFor(async () => { expect((await messagesLink())?.textContent).toBe("Messages"); });

    await user.click(screen.getByRole("button", { name: "Aide et support" }));
    expect(await screen.findByRole("dialog", { name: "Aide et support" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Fermer l’aide" }));
    await waitFor(() => { expect(screen.queryByRole("dialog")).toBeNull(); });
  });
});
