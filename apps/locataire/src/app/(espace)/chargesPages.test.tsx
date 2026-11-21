import { isValidElement } from "react";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CHARGE_IDS } from "@/tenant/chargeResponses.fixtures";

const state = vi.hoisted((): { mode: "demo" | "api" } => ({ mode: "api" }));

vi.mock("@/lib/env", () => ({
  get dataSource() {
    return state.mode;
  },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  notFound: () => {
    throw new Error("notFound");
  },
}));

beforeEach(() => {
  state.mode = "api";
});

function child(element: ReactElement<{ children: ReactElement }>): ReactElement {
  return element.props.children;
}

describe("route d’un décompte de charges", () => {
  it("rend le détail pour l’identifiant d’un décompte en mode api", async () => {
    const { ChargeRoute } = await import("@/features/charges/ChargeRoute");

    const element = await ChargeRoute({ params: Promise.resolve({ id: CHARGE_IDS.statement }) });

    expect(element.props).toEqual({ id: CHARGE_IDS.statement });
  });

  it.each(["conge", "pas-un-uuid", `${CHARGE_IDS.statement}/../x`, ""])("refuse %j par un 404 sans appeler le serveur", async (id) => {
    const { ChargeRoute } = await import("@/features/charges/ChargeRoute");

    await expect(ChargeRoute({ params: Promise.resolve({ id }) })).rejects.toThrow("notFound");
  });

  it("répond 404 en mode démo, où aucun décompte réel n’existe", async () => {
    state.mode = "demo";
    const { ChargeRoute } = await import("@/features/charges/ChargeRoute");

    await expect(ChargeRoute({ params: Promise.resolve({ id: CHARGE_IDS.statement }) })).rejects.toThrow("notFound");
  });

  it("la page de détail passe par ChargeRoute", async () => {
    const { default: Page } = await import("./loyers/regularisation/[id]/page");
    const { ChargeRoute } = await import("@/features/charges/ChargeRoute");

    const element = child(Page({ params: Promise.resolve({ id: CHARGE_IDS.statement }) } as never));

    expect(element.type).toBe(ChargeRoute);
  });
});

describe("page de la régularisation des charges", () => {
  it("sert la liste réelle en api et l’écran de démonstration en démo", async () => {
    const { default: Page } = await import("./loyers/regularisation/page");
    const { ChargeStatementsScreen } = await import("@/features/charges/ChargeStatementsScreen");
    const { ChargesScreen } = await import("@/features/loyers/ChargesScreen");

    expect(isValidElement(Page())).toBe(true);
    expect(child(Page()).type).toBe(ChargeStatementsScreen);
    state.mode = "demo";
    expect(child(Page()).type).toBe(ChargesScreen);
  });
});
