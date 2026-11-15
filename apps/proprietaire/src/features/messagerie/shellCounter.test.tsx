import { demoShell } from "@eguardimmo/gestion";
import { demoSeeds } from "@eguardimmo/messagerie";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Providers } from "@/app/providers";
import { EspaceShell } from "@/app/(espace)/EspaceShell";
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

beforeEach(() => {
  flowNavigation.push = () => undefined;
});

function setup(start: string) {
  return renderFlow({
    prefix: "",
    start,
    wrap: (children) => (
      <Providers>
        <EspaceShell>{children}</EspaceShell>
      </Providers>
    ),
  });
}

const sidebar = () => screen.getByRole("navigation", { name: "Navigation principale" });

describe("compteur de messages non lus de l'espace bailleur", () => {
  it("part du même nombre que les fixtures de la messagerie", () => {
    const unread = demoSeeds.bailleur().conversations.filter((conversation) => conversation.unread && !conversation.archived).length;
    expect(demoShell.counts.unreadMessages).toBe(unread);
  });

  it("baisse à chaque conversation lue, jusqu'à disparaître", async () => {
    setup("/messages");
    const list = await screen.findByRole("list", { name: "Conversations" });
    expect(await within(sidebar()).findByRole("link", { name: /Messages\s*2$/ })).toBeTruthy();

    await userEvent.click(firstOf(within(list).getAllByRole("link")));
    await screen.findByRole("list", { name: "Fil de la conversation" });
    expect(await within(sidebar()).findByRole("link", { name: /Messages\s*1$/ })).toBeTruthy();

    await userEvent.click(screen.getByRole("link", { name: "Messages" }));
    const next = await screen.findByRole("list", { name: "Conversations" });
    await userEvent.click(within(next).getByRole("link", { name: /Ibrahim Yao/ }));
    await screen.findByRole("list", { name: "Fil de la conversation" });
    await waitFor(() => {
      expect(within(sidebar()).queryByRole("link", { name: /Messages\s*\d/ })).toBeNull();
    });
  });
});
