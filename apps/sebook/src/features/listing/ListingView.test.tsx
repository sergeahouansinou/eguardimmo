import { screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MARKETPLACE, renderApp, stubApi } from "../../../test/api";
import { expectNoA11yViolations } from "../../../test/axe";
import { clearPublicReads } from "@/marketplace/cached";
import { AVAILABILITY, DETAIL, QUOTE, REF } from "@/marketplace/responses.fixtures";
import { ListingView } from "./ListingView";

const L = `${MARKETPLACE}/listings/${REF}`;

function view(ref: string, search: Record<string, string> = {}) {
  return ListingView({ params: Promise.resolve({ ref }), searchParams: Promise.resolve(search) });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2027-03-01T10:00:00Z"));
});

afterEach(() => {
  clearPublicReads();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("ListingView", () => {
  it("rend la fiche avec ses données structurées et le séjour demandé dans l’adresse", async () => {
    const api = stubApi({ [`GET ${L}`]: { body: { data: DETAIL } }, [`GET ${L}/availability`]: { body: AVAILABILITY }, [`POST ${L}/quote`]: { body: QUOTE } });
    const { container } = renderApp(await view(REF, { arrivee: "2027-03-20", depart: "2027-03-22", voyageurs: "2" }));

    expect(screen.getByRole("heading", { level: 1, name: DETAIL.title })).toBeTruthy();
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(JSON.parse(script?.textContent ?? "{}")).toMatchObject({ "@type": "Accommodation", name: DETAIL.title, url: `http://sebook.test/listings/${REF}` });
    expect(api.count("GET", L)).toBe(1);
    expect(await screen.findByText("153 €")).toBeTruthy();
    expect(api.last("POST", `${L}/quote`)?.json).toEqual({ check_in: "2027-03-20", check_out: "2027-03-22", guests: 2 });
    await expectNoA11yViolations(container);
  });

  it("répond « introuvable » pour une référence absente (404 de l’API)", async () => {
    stubApi({ [`GET ${L}`]: { status: 404, body: {} } });
    await expect(view(REF)).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
  });

  it("n’appelle pas l’API pour une référence mal formée", async () => {
    const api = stubApi();
    await expect(view("../../etc/passwd")).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
    expect(api.calls.filter((call) => call.path.includes("listings"))).toHaveLength(0);
  });

  it("distingue une annonce indisponible (panne de l’API) d’une annonce absente", async () => {
    stubApi({ [`GET ${L}`]: { status: 503, body: {} } });
    renderApp(await view(REF));
    expect(screen.getByRole("heading", { name: "Annonce indisponible" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Revenir à l’accueil" }).getAttribute("href")).toBe("/");
    await waitFor(() => {
      expect(screen.queryByText(DETAIL.title)).toBeNull();
    });
  });
});
