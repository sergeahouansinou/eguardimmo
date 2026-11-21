import { isValidElement } from "react";
import type { ReactElement } from "react";
import { notFound } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiAssuranceScreen } from "@/features/assurance/ApiAssuranceScreen";
import { ApiDepotScreen } from "@/features/assurance/ApiDepotScreen";
import { AssuranceScreen } from "@/features/assurance/AssuranceScreen";
import { DepotScreen } from "@/features/assurance/DepotScreen";
import { ApiCongeScreen } from "@/features/bail/ApiCongeScreen";
import { CongeScreen } from "@/features/bail/CongeScreen";
import { ApiModifierScreen } from "@/features/compte/ApiModifierScreen";
import { ModifierScreen } from "@/features/compte/ModifierScreen";
import { ApiDocumentsScreen } from "@/features/documents/ApiDocumentsScreen";
import { DocumentsScreen } from "@/features/documents/DocumentsScreen";
import { ApiEtatDetailScreen } from "@/features/etats/ApiEtatDetailScreen";
import { ApiEtatsScreen } from "@/features/etats/ApiEtatsScreen";
import { EtatDetailScreen } from "@/features/etats/EtatDetailScreen";
import { EtatsScreen } from "@/features/etats/EtatsScreen";
import { ApiPayerScreen } from "@/features/loyers/ApiPayerScreen";
import { ApiPaymentReturnScreen } from "@/features/loyers/ApiPaymentReturnScreen";
import { PayerScreen } from "@/features/loyers/PayerScreen";
import { ID } from "@/tenant/complementsResponses.fixtures";

const state = vi.hoisted((): { mode: "demo" | "api" } => ({ mode: "api" }));

vi.mock("@/lib/env", () => ({
  get dataSource() {
    return state.mode;
  },
}));

beforeEach(() => {
  state.mode = "api";
  vi.mocked(notFound).mockImplementation(() => {
    throw new Error("notFound");
  });
});

function screenOf(element: ReactElement<{ children: ReactElement }>): ReactElement {
  return element.props.children;
}

const PAGES = [
  ["documents", () => import("./(espace)/documents/page"), ApiDocumentsScreen, DocumentsScreen],
  ["assurance", () => import("./(espace)/assurance/page"), ApiAssuranceScreen, AssuranceScreen],
  ["assurance/deposer", () => import("./(espace)/assurance/deposer/page"), ApiDepotScreen, DepotScreen],
  ["bail/conge", () => import("./(espace)/bail/conge/page"), ApiCongeScreen, CongeScreen],
  ["etats-des-lieux", () => import("./(espace)/etats-des-lieux/page"), ApiEtatsScreen, EtatsScreen],
  ["loyers/payer", () => import("./(espace)/loyers/payer/page"), ApiPayerScreen, PayerScreen],
  ["compte/modifier", () => import("./(espace)/compte/modifier/page"), ApiModifierScreen, ModifierScreen],
] as const;

describe("pages des compléments du locataire", () => {
  it.each(PAGES)("%s : l’écran réel en mode api, l’écran de démonstration en mode démo", async (_name, load, apiScreen, demoScreen) => {
    const { default: Page } = await load();

    expect(screenOf(Page()).type).toBe(apiScreen);
    state.mode = "demo";
    expect(screenOf(Page()).type).toBe(demoScreen);
  });

  it("le retour de paiement n’existe qu’en mode api", async () => {
    const { default: Page } = await import("./(espace)/paiement/retour/page");

    expect(screenOf(Page()).type).toBe(ApiPaymentReturnScreen);
    state.mode = "demo";
    expect(() => Page()).toThrow("notFound");
  });
});

describe("route d’un état des lieux", () => {
  it("rend le détail réel pour un identifiant en mode api", async () => {
    const { EtatRoute } = await import("@/features/etats/EtatRoute");

    const element = await EtatRoute({ params: Promise.resolve({ id: ID.inspectionEntry }) });

    expect(isValidElement(element)).toBe(true);
    expect(element.type).toBe(ApiEtatDetailScreen);
    expect(element.props).toEqual({ id: ID.inspectionEntry });
  });

  it.each(["pas-un-uuid", "", `${ID.inspectionEntry}/../x`])("refuse %j sans appeler le serveur en mode api", async (id) => {
    const { EtatRoute } = await import("@/features/etats/EtatRoute");

    await expect(EtatRoute({ params: Promise.resolve({ id }) })).rejects.toThrow("notFound");
  });

  it("garde l’écran de démonstration en mode démo", async () => {
    state.mode = "demo";
    const { EtatRoute } = await import("@/features/etats/EtatRoute");

    const element = await EtatRoute({ params: Promise.resolve({ id: "etat-entree" }) });

    expect(element.type).toBe(EtatDetailScreen);
    expect(element.props).toEqual({ inspectionId: "etat-entree" });
  });
});
