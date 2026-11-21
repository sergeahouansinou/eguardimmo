import { screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useTenantSession } from "./session";
import { NO_PROFILES, TENANT_PROFILES, problem } from "./responses.fixtures";
import { AUTH_URL, renderApi, stubApi } from "../../test/api";

function Probe() {
  useTenantSession();
  return <p>Espace ouvert</p>;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("session locataire", () => {
  it("ouvre l’espace avec le profil locataire", async () => {
    const api = stubApi();

    renderApi(<Probe />);

    expect(await screen.findByText("Espace ouvert")).toBeTruthy();
    expect(api.count("GET", "/api/v1/me/profiles")).toBe(1);
  });

  it("n’affiche aucune donnée de démonstration sans profil locataire et renvoie vers l’authentification", async () => {
    stubApi({ "GET /api/v1/me/profiles": { body: NO_PROFILES } });

    renderApi(<Probe />);

    expect(await screen.findByText("Aucun accès locataire")).toBeTruthy();
    expect(screen.queryByText("Espace ouvert")).toBeNull();
    expect(screen.getByRole("link", { name: "Choisir un autre espace" }).getAttribute("href")).toBe(`${AUTH_URL}/profils`);
    expect(document.body.textContent).toContain("invitation");
  });

  it("renvoie vers la connexion avec le retour sur la page en cas de 401", async () => {
    stubApi({ "GET /api/v1/me/profiles": { status: 401, body: problem(401, "unauthenticated", "Non authentifié.") } });

    renderApi(<Probe />);

    const link = await screen.findByRole("link", { name: "Se connecter" });
    const href = new URL(link.getAttribute("href") ?? "");
    expect(href.origin).toBe(AUTH_URL);
    expect(href.pathname).toBe("/connexion");
    expect(href.searchParams.get("return_to")).toBe(window.location.href);
    expect(screen.getByText("Connexion requise")).toBeTruthy();
    expect(screen.queryByText("Espace ouvert")).toBeNull();
  });

  it("propose de réessayer après une panne serveur, puis ouvre l’espace", async () => {
    let attempts = 0;
    stubApi({
      "GET /api/v1/me/profiles": () => {
        attempts += 1;
        return attempts === 1 ? { status: 503, body: problem(503, "service_unavailable", "Service indisponible.") } : { body: TENANT_PROFILES };
      },
    });

    const { user } = renderApi(<Probe />);

    expect(await screen.findByText("Impossible d’ouvrir votre espace")).toBeTruthy();
    expect(screen.getByText("Service indisponible.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Réessayer" }));
    await waitFor(() => { expect(screen.getByText("Espace ouvert")).toBeTruthy(); });
  });

  it("explique un compte non vérifié sans proposer de réessayer", async () => {
    stubApi({ "GET /api/v1/me/profiles": { status: 403, body: problem(403, "email_unverified", "Adresse non vérifiée.") } });

    renderApi(<Probe />);

    expect(await screen.findByText(/Confirmez votre adresse e-mail/)).toBeTruthy();
  });

  it("signale un serveur injoignable", async () => {
    stubApi();
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new TypeError("réseau"))));

    renderApi(<Probe />);

    expect(await screen.findByText(/injoignable/)).toBeTruthy();
  });
});
