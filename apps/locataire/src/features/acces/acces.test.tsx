import { QueryClient } from "@tanstack/react-query";
import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  LEASE_ID,
  NO_PROFILES,
  ORG_LOIRE,
  ORG_PORT,
  PARTY_LOIRE_ID,
  PARTY_PORT_ID,
  TENANT_PROFILES,
  leasePage,
  links,
  problem,
  summary,
} from "@/tenant/responses.fixtures";
import { expectNoA11yViolations } from "../../../test/axe";
import { renderApi, stubApi } from "../../../test/api";
import { nav } from "../../../test/navigation";
import { LeasesScreen } from "../baux/LeasesScreen";
import { LinksScreen } from "./LinksScreen";

const TWO_LINKS = links([
  { id: PARTY_PORT_ID, organization: ORG_PORT },
  { id: PARTY_LOIRE_ID, organization: ORG_LOIRE },
]);

afterEach(() => {
  vi.unstubAllGlobals();
});

function Both() {
  return (
    <>
      <LinksScreen />
      <LeasesScreen />
    </>
  );
}

describe("mes accès", () => {
  it("liste les organisations reliées au compte", async () => {
    const api = stubApi({ "GET /api/v1/tenant/links": { body: TWO_LINKS } });

    const { container } = renderApi(<LinksScreen />, { pathname: "/acces" });

    const region = await screen.findByRole("region", { name: "Organisations reliées à mon compte" });
    expect(within(region).getByText("Agence du Port")).toBeTruthy();
    expect(within(region).getByText("Immo Loire")).toBeTruthy();
    expect(within(region).getByRole("button", { name: "Retirer mon accès à Agence du Port" })).toBeTruthy();
    expect(api.count("GET", "/api/v1/tenant/links")).toBe(1);
    await expectNoA11yViolations(container);
  });

  it("n’appelle rien tant que la confirmation n’est pas donnée, et annuler ferme sans requête", async () => {
    const api = stubApi({ "GET /api/v1/tenant/links": { body: TWO_LINKS } });

    const { user } = renderApi(<LinksScreen />, { pathname: "/acces" });
    await user.click(await screen.findByRole("button", { name: "Retirer mon accès à Agence du Port" }));

    const dialog = await screen.findByRole("dialog", { name: "Retirer votre accès à Agence du Port ?" });
    expect(within(dialog).getByText(/Elle conserve vos baux et leurs pièces/)).toBeTruthy();
    await user.click(within(dialog).getByRole("button", { name: "Annuler" }));

    await waitFor(() => { expect(screen.queryByRole("dialog")).toBeNull(); });
    expect(api.calls.some((call) => call.method === "DELETE")).toBe(false);
  });

  it("retire le lien confirmé par DELETE puis recharge les liens, les baux et la session", async () => {
    let revoked = false;
    const api = stubApi({
      "GET /api/v1/tenant/links": () => ({ body: revoked ? links([{ id: PARTY_LOIRE_ID, organization: ORG_LOIRE }]) : TWO_LINKS }),
      "GET /api/v1/tenant/leases": () => ({ body: leasePage(revoked ? [] : [summary()]) }),
      [`DELETE /api/v1/tenant/links/${PARTY_PORT_ID}`]: () => {
        revoked = true;
        return { status: 204 };
      },
    });

    const { user } = renderApi(<Both />, { pathname: "/acces" });
    await screen.findByText("BAIL-2026-001");
    await user.click(screen.getByRole("button", { name: "Retirer mon accès à Agence du Port" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Retirer mon accès" }));

    expect(await screen.findByText("Accès retiré")).toBeTruthy();
    expect(screen.getByText("Votre compte n’est plus relié à Agence du Port.")).toBeTruthy();
    await waitFor(() => { expect(screen.queryByText("BAIL-2026-001")).toBeNull(); });
    expect(screen.queryByRole("button", { name: "Retirer mon accès à Agence du Port" })).toBeNull();
    expect(screen.getByRole("button", { name: "Retirer mon accès à Immo Loire" })).toBeTruthy();
    const deletes = api.calls.filter((call) => call.method === "DELETE");
    expect(deletes).toHaveLength(1);
    expect(deletes[0]?.path).toBe(`/api/v1/tenant/links/${PARTY_PORT_ID}`);
    expect(api.count("GET", "/api/v1/tenant/links")).toBe(2);
    expect(api.count("GET", "/api/v1/tenant/leases")).toBe(2);
    expect(api.count("GET", "/api/v1/me/profiles")).toBe(2);
    expect(nav.pathname).toBe("/acces");
  });

  it("referme l’espace quand le dernier lien est retiré : plus de profil locataire", async () => {
    let revoked = false;
    stubApi({
      "GET /api/v1/me/profiles": () => ({ body: revoked ? NO_PROFILES : TENANT_PROFILES }),
      "GET /api/v1/tenant/links": { body: links([{ id: PARTY_PORT_ID, organization: ORG_PORT }]) },
      [`DELETE /api/v1/tenant/links/${PARTY_PORT_ID}`]: () => {
        revoked = true;
        return { status: 204 };
      },
    });

    const { user } = renderApi(<LinksScreen />, { pathname: "/acces" });
    await user.click(await screen.findByRole("button", { name: "Retirer mon accès à Agence du Port" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Retirer mon accès" }));

    expect(await screen.findByText("Aucun accès locataire")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Organisations reliées à mon compte" })).toBeNull();
  });

  it.each([
    [404, "tenant_access_not_found", /Cet accès a déjà été retiré/, true],
    [403, "operator_token_forbidden", /pas le droit/, false],
    [429, "http_429", /Trop de demandes/, false],
    [401, "unauthenticated", /session a expiré/, false],
  ])("affiche l’erreur %s dans la confirmation sans retirer le lien", async (status, code, message, refreshes) => {
    const api = stubApi({
      "GET /api/v1/tenant/links": { body: TWO_LINKS },
      [`DELETE /api/v1/tenant/links/${PARTY_PORT_ID}`]: { status, body: problem(status, code, "Détail serveur.") },
    });

    const { user } = renderApi(<LinksScreen />, { pathname: "/acces" });
    await user.click(await screen.findByRole("button", { name: "Retirer mon accès à Agence du Port" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Retirer mon accès" }));

    expect((await within(dialog).findByRole("alert")).textContent).toMatch(message);
    expect(screen.queryByText("Accès retiré")).toBeNull();
    await waitFor(() => { expect(api.count("GET", "/api/v1/tenant/links")).toBe(refreshes ? 2 : 1); });
  });

  it("explique l’échec de lecture des accès et permet de réessayer", async () => {
    let attempts = 0;
    stubApi({
      "GET /api/v1/tenant/links": () => {
        attempts += 1;
        return attempts === 1 ? { status: 503, body: problem(503, "service_unavailable", "Service indisponible.") } : { body: TWO_LINKS };
      },
    });

    const { user } = renderApi(<LinksScreen />, { pathname: "/acces" });
    expect(await screen.findByText("Vos accès n’ont pas pu être chargés")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Réessayer" }));

    expect(await screen.findByText("Immo Loire")).toBeTruthy();
  });

  it("nomme une organisation inconnue « Non disponible »", async () => {
    stubApi({ "GET /api/v1/tenant/links": { body: links([{ id: PARTY_PORT_ID, organization: { id: ORG_PORT.id, name: null } }]) } });

    renderApi(<LinksScreen />, { pathname: "/acces" });

    expect(await screen.findByRole("button", { name: "Retirer mon accès à Non disponible" })).toBeTruthy();
  });
});

describe("cohérence du cache", () => {
  it("invalide aussi le détail d’un bail déjà consulté", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(["tenant", "lease", LEASE_ID], { id: LEASE_ID });
    stubApi({
      "GET /api/v1/tenant/links": { body: links([{ id: PARTY_PORT_ID, organization: ORG_PORT }]) },
      [`DELETE /api/v1/tenant/links/${PARTY_PORT_ID}`]: { status: 204 },
    });

    const { user } = renderApi(<LinksScreen />, { pathname: "/acces", client });
    await user.click(await screen.findByRole("button", { name: "Retirer mon accès à Agence du Port" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Retirer mon accès" }));

    await waitFor(() => { expect(client.getQueryState(["tenant", "lease", LEASE_ID])?.isInvalidated).toBe(true); });
  });
});
