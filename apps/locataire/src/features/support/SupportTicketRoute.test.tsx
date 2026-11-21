import { render, screen } from "@testing-library/react";
import { notFound } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted((): { mode: "demo" | "api" } => ({ mode: "api" }));

vi.mock("@/lib/env", () => ({
  get dataSource() {
    return state.mode;
  },
}));

vi.mock("@eguardimmo/messagerie", () => ({
  SupportTicketPage: ({ ticketId }: { ticketId: string }) => <p>Demande {ticketId}</p>,
}));

const UUID = "0193a5e1-0000-7000-8000-0000000000a1";

beforeEach(() => {
  state.mode = "api";
  vi.mocked(notFound).mockReset();
});

afterEach(() => {
  vi.resetModules();
});

async function route(id: string) {
  const { SupportTicketRoute } = await import("./SupportTicketRoute");
  return SupportTicketRoute({ params: Promise.resolve({ id }) });
}

describe("route d’une demande au support (api)", () => {
  it("ouvre la demande d’un identifiant valide", async () => {
    render(await route(UUID));

    expect(screen.getByText(`Demande ${UUID}`)).toBeTruthy();
    expect(notFound).not.toHaveBeenCalled();
  });

  it.each(["nouvelle", "12", "../../etc", `${UUID}/extra`])("refuse l’identifiant %s", async (id) => {
    await route(id);

    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it("n’existe pas en mode démonstration", async () => {
    state.mode = "demo";

    await route(UUID);

    expect(notFound).toHaveBeenCalledTimes(1);
  });
});
