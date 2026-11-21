import { isValidElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

describe("pages du support de l'agence", () => {
  it.each([
    ["liste", () => import("./page")],
    ["nouvelle demande", () => import("./nouvelle/page")],
    ["accès du support", () => import("../reglages/acces-support/page")],
  ] as const)("la page %s n'existe qu'en mode api", async (_name, load) => {
    const { default: Page } = await load();

    expect(isValidElement(Page())).toBe(true);
    state.mode = "demo";
    expect(() => Page()).toThrow("notFound");
  });
});
