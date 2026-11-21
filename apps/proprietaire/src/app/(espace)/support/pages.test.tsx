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
  redirect: (href: string) => {
    throw new Error(`redirect:${href}`);
  },
}));

beforeEach(() => {
  state.mode = "api";
});

describe("pages du support du bailleur autonome", () => {
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

  it("le fil d'une demande n'existe qu'en mode api", async () => {
    const { default: Page } = await import("./[id]/page");
    const props = { params: Promise.resolve({ id: "x" }), searchParams: Promise.resolve({}) };

    expect(isValidElement(Page(props))).toBe(true);
    state.mode = "demo";
    expect(() => Page(props)).toThrow("notFound");
  });

  it("« Discuter avec le support » mène à la liste en api et garde la page de démonstration en démo", async () => {
    const { default: Page } = await import("../aide/support/page");

    expect(() => Page()).toThrow("redirect:/support");
    state.mode = "demo";
    expect(isValidElement(Page())).toBe(true);
  });
});
