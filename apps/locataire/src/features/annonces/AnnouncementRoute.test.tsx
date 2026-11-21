import { isValidElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ANNOUNCEMENT_ID } from "@eguardimmo/messagerie/announcements-testing";

const state = vi.hoisted((): { mode: "demo" | "api" } => ({ mode: "api" }));

vi.mock("@/lib/env", () => ({
  get dataSource() {
    return state.mode;
  },
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("notFound");
  },
}));

beforeEach(() => {
  state.mode = "api";
});

describe("routes des annonces du locataire", () => {
  it("rend la liste en mode api", async () => {
    const { AnnouncementsRoute } = await import("./AnnouncementRoute");
    expect(isValidElement(AnnouncementsRoute())).toBe(true);
  });

  it("rend le détail pour l’identifiant d’une annonce en mode api", async () => {
    const { AnnouncementRoute } = await import("./AnnouncementRoute");
    const element = await AnnouncementRoute({ params: Promise.resolve({ id: ANNOUNCEMENT_ID }) });
    expect(isValidElement(element)).toBe(true);
    expect(element.props).toEqual({ announcementId: ANNOUNCEMENT_ID });
  });

  it.each(["pas-un-uuid", "0193a5e1-0000-7000-8000-00000000000", `${ANNOUNCEMENT_ID}/../x`, ""])("refuse %j par un 404 sans appeler le serveur", async (id) => {
    const { AnnouncementRoute } = await import("./AnnouncementRoute");
    await expect(AnnouncementRoute({ params: Promise.resolve({ id }) })).rejects.toThrow("notFound");
  });

  it("répond 404 en mode démo, où aucune annonce réelle n’existe", async () => {
    state.mode = "demo";
    const { AnnouncementRoute, AnnouncementsRoute } = await import("./AnnouncementRoute");
    await expect(AnnouncementRoute({ params: Promise.resolve({ id: ANNOUNCEMENT_ID }) })).rejects.toThrow("notFound");
    expect(() => AnnouncementsRoute()).toThrow("notFound");
  });
});
