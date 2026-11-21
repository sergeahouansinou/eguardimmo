import { ACCOUNT_IDS, devicesAfterRevocation, devicesResponse, meResponse, securityResponse } from "@eguardimmo/shell/account/fixtures";
import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../../../test/axe";
import { renderApi, stubApi } from "../../../test/api";
import { ApiInformationsScreen, ApiSecuriteScreen } from "./ApiAccountScreens";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Mes informations du locataire en mode api", () => {
  it("affiche l’identité lue sur /me, sans donnée de démonstration ni onglet indisponible", async () => {
    const api = stubApi({ "GET /api/v1/me": { body: meResponse } });

    const { container } = renderApi(<ApiInformationsScreen />, { pathname: "/compte" });

    expect(await screen.findByRole("heading", { level: 1, name: "Mes informations" })).toBeTruthy();
    expect(await screen.findByText("Jeanne Martin")).toBeTruthy();
    expect(screen.getByText("jeanne@exemple.fr")).toBeTruthy();
    expect(await screen.findByText("Espace locataire")).toBeTruthy();
    const tabs = screen.getByRole("navigation", { name: "Mon compte" });
    expect(within(tabs).getAllByRole("link").map((link) => link.textContent)).toEqual(["Informations", "Sécurité"]);
    for (const demo of ["Koffi", "Adjovi", "4417", "Prélèvement"]) expect(document.body.textContent).not.toContain(demo);
    expect(api.calls.some((call) => call.method !== "GET")).toBe(false);
    await expectNoA11yViolations(container);
  });
});

describe("Connexion et sécurité du locataire en mode api", () => {
  it("affiche l’état de sécurité et les appareils du serveur, et révoque l’appareil confirmé", async () => {
    let revoked = false;
    const api = stubApi({
      "GET /api/v1/me/security": { body: securityResponse },
      "GET /api/v1/me/devices": () => ({ body: revoked ? devicesAfterRevocation : devicesResponse }),
      [`DELETE /api/v1/me/devices/${ACCOUNT_IDS.otherDevice}`]: () => {
        revoked = true;
        return { status: 204 };
      },
    });

    const { container, user } = renderApi(<ApiSecuriteScreen />, { pathname: "/compte/securite" });

    expect(await screen.findByRole("heading", { level: 1, name: "Connexion et sécurité" })).toBeTruthy();
    expect(await screen.findByText("Non activée")).toBeTruthy();
    expect(await screen.findByText("Pixel 9")).toBeTruthy();
    await expectNoA11yViolations(container);
    await user.click(screen.getByRole("button", { name: "Révoquer Pixel 9" }));
    await user.click(await screen.findByRole("button", { name: "Révoquer l’appareil" }));

    expect(await screen.findByText("« Pixel 9 » a été déconnecté.")).toBeTruthy();
    await waitFor(() => { expect(screen.queryByRole("button", { name: /Révoquer/ })).toBeNull(); });
    expect(api.calls.filter((call) => call.method === "DELETE").map((call) => call.path)).toEqual([`/api/v1/me/devices/${ACCOUNT_IDS.otherDevice}`]);
    expect(screen.queryByText("Jeanne Martin")).toBeNull();
    for (const demo of ["Koffi", "Application d'authentification", "Forte"]) expect(document.body.textContent).not.toContain(demo);
  });

  it("renvoie la suppression du compte vers le hub d’authentification", async () => {
    const api = stubApi({
      "GET /api/v1/me/security": { body: securityResponse },
      "GET /api/v1/me/devices": { body: devicesResponse },
    });

    renderApi(<ApiSecuriteScreen />, { pathname: "/compte/securite" });

    const link = await screen.findByRole("link", { name: /Supprimer mon compte/ });
    expect(link.getAttribute("href")).toBe("http://localhost:3040/compte/supprimer");
    expect(api.calls.some((call) => call.method === "DELETE")).toBe(false);
  });
});
