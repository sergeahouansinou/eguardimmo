import { isValidElement } from "react";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiOnly } from "@/owner/ApiOnly";
import { Resolved, WithParam } from "@/owner/WithParam";

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

type Page = (props: object) => unknown;

describe("pages des décomptes de charges de l'espace propriétaire", () => {
  it.each([
    ["liste", () => import("./page"), {}],
    ["détail", () => import("./[id]/page"), { params: Promise.resolve({ id: "x" }) }],
  ] as const)("la page %s n'existe qu'en mode api", async (_name, load, props) => {
    const { default: Page } = (await load()) as { default: Page };

    const element = Page(props);
    expect(isValidElement(element) && element.type === ApiOnly).toBe(true);
    expect(ApiOnly({ children: null })).toBeNull();
    state.mode = "demo";
    expect(() => ApiOnly({ children: null })).toThrow("notFound");
  });

  it("le détail refuse un identifiant qui n'est pas un UUID", async () => {
    const { default: Page } = (await import("./[id]/page")) as { default: Page };
    const only = Page({ params: Promise.resolve({ id: "x" }) });
    if (!isValidElement<{ children: ReactElement }>(only)) throw new Error("page inattendue");
    const guarded = only.props.children;

    expect(guarded.type).toBe(WithParam);
    await expect(Resolved({ params: Promise.resolve({ id: "pas-un-uuid" }), name: "id", children: () => null })).rejects.toThrow("notFound");
    await expect(Resolved({ params: Promise.resolve({ id: "0193a5e1-0000-7000-8000-000000000501" }), name: "id", children: () => null })).resolves.toBeTruthy();
  });
});
