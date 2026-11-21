import { isValidElement } from "react";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LEASE_ID } from "@/tenant/responses.fixtures";

const state = vi.hoisted((): { mode: "demo" | "api" } => ({ mode: "api" }));

vi.mock("@/lib/env", () => ({
  get dataSource() {
    return state.mode;
  },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn() }),
  notFound: () => {
    throw new Error("notFound");
  },
}));

beforeEach(() => {
  state.mode = "api";
});

describe("route d’un bail", () => {
  it("rend le détail pour l’identifiant d’un bail en mode api", async () => {
    const { LeaseRoute } = await import("@/features/baux/LeaseRoute");

    const element = await LeaseRoute({ params: Promise.resolve({ id: LEASE_ID }) });

    expect(isValidElement(element)).toBe(true);
    expect(element.props).toEqual({ id: LEASE_ID });
  });

  it.each(["conge", "pas-un-uuid", "0193a5e1-0000-7000-8000-00000000000", `${LEASE_ID}/../x`, ""])("refuse %j par un 404 sans appeler le serveur", async (id) => {
    const { LeaseRoute } = await import("@/features/baux/LeaseRoute");

    await expect(LeaseRoute({ params: Promise.resolve({ id }) })).rejects.toThrow("notFound");
  });

  it("répond 404 en mode démo, où aucun bail réel n’existe", async () => {
    state.mode = "demo";
    const { LeaseRoute } = await import("@/features/baux/LeaseRoute");

    await expect(LeaseRoute({ params: Promise.resolve({ id: LEASE_ID }) })).rejects.toThrow("notFound");
  });
});

describe("page des accès", () => {
  it("n’existe qu’en mode api", async () => {
    const { default: Page } = await import("./acces/page");

    expect(isValidElement(Page())).toBe(true);
    state.mode = "demo";
    expect(() => Page()).toThrow("notFound");
  });
});

function child(element: ReactElement<{ children: ReactElement }>): ReactElement {
  return element.props.children;
}

const RENT_ID = "01a1e955-004b-709d-9353-b6f2e30e1028";

describe("routes des loyers", () => {
  it.each([
    ["echeance", { id: RENT_ID }],
    ["quittance", { id: RENT_ID }],
    ["paiement", { id: RENT_ID }],
  ] as const)("rend l’écran %s pour un identifiant en mode api", async (kind, params) => {
    const { RentRoute } = await import("@/features/rent/RentRoute");

    const element = await RentRoute({ kind, params: Promise.resolve(params) });

    expect(element.props).toEqual({ id: RENT_ID });
  });

  it.each(["conge", "pas-un-uuid", `${RENT_ID}/../x`, ""])("refuse %j par un 404", async (id) => {
    const { RentRoute } = await import("@/features/rent/RentRoute");

    await expect(RentRoute({ kind: "quittance", params: Promise.resolve({ id }) })).rejects.toThrow("notFound");
  });

  it("répond 404 en mode démo pour les écrans réels", async () => {
    state.mode = "demo";
    const { RentRoute } = await import("@/features/rent/RentRoute");

    await expect(RentRoute({ kind: "echeance", params: Promise.resolve({ id: RENT_ID }) })).rejects.toThrow("notFound");
  });

  it.each([
    ["quittances", () => import("./loyers/quittances/page")],
    ["paiements", () => import("./loyers/paiements/page")],
  ] as const)("la liste des %s n’existe qu’en mode api", async (_name, load) => {
    const { default: Page } = await load();

    expect(isValidElement(Page())).toBe(true);
    state.mode = "demo";
    expect(() => Page()).toThrow("notFound");
  });

  it("sert Mes loyers en api et l’écran de démonstration en démo", async () => {
    const { default: Page } = await import("./loyers/page");
    const { InstallmentsScreen } = await import("@/features/rent/InstallmentsScreen");
    const { LoyersScreen } = await import("@/features/loyers/LoyersScreen");

    expect(child(Page()).type).toBe(InstallmentsScreen);
    state.mode = "demo";
    expect(child(Page()).type).toBe(LoyersScreen);
  });

  it.each([
    ["quittances", () => import("./loyers/quittances/[id]/page")],
    ["paiements", () => import("./loyers/paiements/[id]/page")],
  ] as const)("le détail des %s branche l’API en mode api seulement", async (_name, load) => {
    const { default: Page } = await load();
    const props = { params: Promise.resolve({ id: RENT_ID }), searchParams: Promise.resolve({}) };

    const api = child(Page(props));
    state.mode = "demo";
    const demo = child(Page(props));

    expect(typeof api.type === "function" ? api.type.name : "").toBe("RentRoute");
    expect(typeof demo.type === "function" ? demo.type.name : "").not.toBe("RentRoute");
  });
});

const INTERVENTION_ID = "01a1f000-0000-7000-8000-000000000010";

describe("routes des interventions", () => {
  it("rend le détail réel pour un identifiant en mode api", async () => {
    const { InterventionRoute } = await import("@/features/interventions/InterventionRoute");

    const element = await InterventionRoute({ params: Promise.resolve({ id: INTERVENTION_ID }) });

    expect(element.props).toEqual({ id: INTERVENTION_ID });
  });

  it.each(["nouvelle", "INT-2026-0001", `${INTERVENTION_ID}/../x`, ""])("refuse %j par un 404", async (id) => {
    const { InterventionRoute } = await import("@/features/interventions/InterventionRoute");

    await expect(InterventionRoute({ params: Promise.resolve({ id }) })).rejects.toThrow("notFound");
  });

  it("répond 404 en mode démo pour le détail réel", async () => {
    state.mode = "demo";
    const { InterventionRoute } = await import("@/features/interventions/InterventionRoute");

    await expect(InterventionRoute({ params: Promise.resolve({ id: INTERVENTION_ID }) })).rejects.toThrow("notFound");
  });

  it("sert la liste réelle en api et l’écran de démonstration en démo", async () => {
    const { default: Page } = await import("./interventions/page");
    const { ApiInterventionsScreen } = await import("@/features/interventions/ApiInterventionsScreen");
    const { InterventionsScreen } = await import("@/features/interventions/InterventionsScreen");

    expect(child(Page()).type).toBe(ApiInterventionsScreen);
    state.mode = "demo";
    expect(child(Page()).type).toBe(InterventionsScreen);
  });

  it("branche le détail réel en api seulement", async () => {
    const { default: Page } = await import("./interventions/[id]/page");
    const props = { params: Promise.resolve({ id: INTERVENTION_ID }), searchParams: Promise.resolve({}) };

    const api = child(Page(props));
    state.mode = "demo";
    const demo = child(Page(props));

    expect(typeof api.type === "function" ? api.type.name : "").toBe("InterventionRoute");
    expect(typeof demo.type === "function" ? demo.type.name : "").not.toBe("InterventionRoute");
  });
});

describe("pages du support", () => {
  it.each([
    ["liste", () => import("./support/page")],
    ["nouvelle demande", () => import("./support/nouvelle/page")],
  ] as const)("la page %s n’existe qu’en mode api", async (_name, load) => {
    const { default: Page } = await load();

    expect(isValidElement(Page())).toBe(true);
    state.mode = "demo";
    expect(() => Page()).toThrow("notFound");
  });

  it("branche le fil d’une demande par sa route", async () => {
    const { default: Page } = await import("./support/[id]/page");
    const { SupportTicketRoute } = await import("@/features/support/SupportTicketRoute");

    expect(child(Page({ params: Promise.resolve({ id: "x" }), searchParams: Promise.resolve({}) })).type).toBe(SupportTicketRoute);
  });
});
