import { isValidElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiOnly } from "@/owner/ApiOnly";

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

describe("pages du support de l'espace propriétaire", () => {
  it.each([
    ["liste", () => import("./page"), {}],
    ["nouvelle demande", () => import("./nouvelle/page"), {}],
    ["fil d'une demande", () => import("./[id]/page"), { params: Promise.resolve({ id: "x" }), searchParams: Promise.resolve({}) }],
  ] as const)("la page %s n'existe qu'en mode api", async (_name, load, props) => {
    const { default: Page } = (await load()) as { default: (props: object) => unknown };

    const element = Page(props);
    expect(isValidElement(element) && element.type === ApiOnly).toBe(true);
    expect(ApiOnly({ children: null })).toBeNull();
    state.mode = "demo";
    expect(() => ApiOnly({ children: null })).toThrow("notFound");
  });
});
