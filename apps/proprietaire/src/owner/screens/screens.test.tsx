import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../../../test/axe";
import { API_URL, AUTH_URL, renderApi, stubApi } from "../../../test/api";
import { ACCESS_ENTRY, ACCESS_ID, LINKS_RESPONSE, SECOND_ACCESS_ENTRY, SECOND_ACCESS_ID, problem } from "../responses.fixtures";
import { AccessesScreen } from "./AccessesScreen";
import { HOME_RESPONSE } from "../home/fixtures";
import { HomeScreen } from "./HomeScreen";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children?: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const HOME = { "GET /api/v1/owner/home": { body: HOME_RESPONSE } };
const DEMO_TEXTS = ["Koffi Adjovi", "Gestion Les Tilleuls", "Apt A1", "Mutuelle Horizon"];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("accueil de l'espace propriétaire en mode api", () => {
  it("affiche l'accès fourni par l'API, sans donnée de démonstration", async () => {
    const stub = stubApi(HOME);
    const { container } = renderApi(<HomeScreen />);

    expect(await screen.findByRole("heading", { level: 1, name: "Mon espace propriétaire" })).toBeTruthy();
    const region = screen.getByRole("region", { name: "Mon accès" });
    expect(within(region).getByText("Agence du Lac")).toBeTruthy();
    expect(within(region).getByText("Famille Dossou")).toBeTruthy();
    expect(within(region).getByText("Titulaire du mandat")).toBeTruthy();
    expect(screen.queryByText(/bientôt disponibles?/)).toBeNull();
    expect(screen.getByRole("link", { name: "Relevé de compte" }).getAttribute("href")).toBe("/confie/releve");
    const sections = screen.getByRole("navigation", { name: "Rubriques de votre espace" });
    expect(within(sections).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/confie/biens",
      "/confie/baux",
      "/confie/loyers",
      "/confie/releve",
      "/confie/comptes-rendus",
      "/confie/documents",
      "/confie/factures",
      "/confie/interventions",
      "/confie/fiscalite",
      "/confie/compte-de-paiement",
      "/confie/messages",
    ]);
    expect(screen.queryByText("Accès en lecture seule", { exact: false })).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
    for (const text of DEMO_TEXTS) expect(document.body.textContent).not.toContain(text);
    expect(stub.calls.every((call) => ["/api/v1/owner/agencies", "/api/v1/owner/home", "/sanctum/csrf-cookie"].includes(call.path))).toBe(true);
    await expectNoA11yViolations(container);
  });

  it("propose un sélecteur quand plusieurs agences donnent accès, et change de mandat", async () => {
    stubApi({ ...HOME, "GET /api/v1/owner/agencies": { body: { data: [ACCESS_ENTRY, SECOND_ACCESS_ENTRY] } } });
    const { user, container } = renderApi(<HomeScreen />);

    const selector = await screen.findByRole("combobox", { name: /Agence et mandant/ });
    expect(within(screen.getByRole("region", { name: "Mon accès" })).getByText("Famille Dossou")).toBeTruthy();
    await expectNoA11yViolations(container);

    await user.click(selector);
    await user.click(await screen.findByRole("option", { name: /SCI Les Palmiers/ }));

    const region = screen.getByRole("region", { name: "Mon accès" });
    expect(within(region).getByText("Cabinet Horizon")).toBeTruthy();
    expect(within(region).getByText("Représentant du titulaire")).toBeTruthy();
  });

  it("annonce l'accès en lecture seule jusqu'à la date de fin de grâce", async () => {
    stubApi({ ...HOME, "GET /api/v1/owner/agencies": { body: { data: [{ ...ACCESS_ENTRY, access_until: "2026-12-31", in_grace: true, read_only: true }] } } });
    const { container } = renderApi(<HomeScreen />);

    expect(await screen.findByText("Accès en lecture seule jusqu’au 31/12/2026")).toBeTruthy();
    expect(screen.getAllByText("Lecture seule").length).toBeGreaterThan(0);
    await expectNoA11yViolations(container);
  });

  it("signale la lecture seule d'un co-indivisaire sans date", async () => {
    stubApi({ ...HOME, "GET /api/v1/owner/agencies": { body: { data: [{ ...ACCESS_ENTRY, role: "co_owner", read_only: true }] } } });
    renderApi(<HomeScreen />);

    expect(await screen.findByText("Accès en lecture seule")).toBeTruthy();
    expect(screen.getAllByText("Co-indivisaire (lecture seule)").length).toBeGreaterThan(0);
  });

  it("affiche un état vide quand aucun mandat n'est relié", async () => {
    stubApi({ "GET /api/v1/owner/agencies": { body: { data: [] } } });
    const { container } = renderApi(<HomeScreen />);

    expect(await screen.findByText("Aucun accès à un mandat")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Choisir un autre espace" }).getAttribute("href")).toBe(`${AUTH_URL}/profils`);
    expect(screen.queryByRole("region", { name: "Mon accès" })).toBeNull();
    await expectNoA11yViolations(container);
  });

  it("invite à créer un accès quand le compte n'a pas d'espace propriétaire (403 space_forbidden)", async () => {
    stubApi({ "GET /api/v1/owner/agencies": problem(403, "space_forbidden") });
    renderApi(<HomeScreen />);

    expect(await screen.findByText("Aucun accès propriétaire")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Choisir un autre espace" }).getAttribute("href")).toBe(`${AUTH_URL}/profils`);
  });

  it("renvoie vers la connexion sur 401", async () => {
    stubApi({ "GET /api/v1/owner/agencies": problem(401, "unauthenticated") });
    renderApi(<HomeScreen />);

    expect(await screen.findByText("Connexion requise")).toBeTruthy();
    const link = screen.getByRole("link", { name: "Se connecter" });
    expect(link.getAttribute("href")).toContain(`${AUTH_URL}/connexion?return_to=`);
  });

  it("renvoie vers la confirmation d'e-mail sur 403 email_unverified", async () => {
    stubApi({ "GET /api/v1/owner/agencies": problem(403, "email_unverified") });
    renderApi(<HomeScreen />);

    expect(await screen.findByText("Impossible d’ouvrir votre espace")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Confirmer mon adresse" }).getAttribute("href")).toBe(`${AUTH_URL}/verification-email`);
  });

  it("propose de réessayer après une panne puis affiche l'accès", async () => {
    let calls = 0;
    stubApi({ ...HOME, "GET /api/v1/owner/agencies": () => (++calls === 1 ? problem(500, "boom") : { body: { data: [ACCESS_ENTRY] } }) });
    const { user } = renderApi(<HomeScreen />);

    await user.click(await screen.findByRole("button", { name: "Réessayer" }));

    expect(await screen.findByRole("region", { name: "Mon accès" })).toBeTruthy();
  });

  it("donne un message générique pour un code d'erreur inconnu", async () => {
    stubApi({ "GET /api/v1/owner/agencies": problem(409, "nouveau_code_du_backend") });
    renderApi(<HomeScreen />);

    expect(await screen.findByText("Une erreur est survenue. Réessayez dans un instant.")).toBeTruthy();
  });

  it("demande l'URL de l'API configurée", async () => {
    const stub = stubApi(HOME);
    renderApi(<HomeScreen />);
    await screen.findByRole("region", { name: "Mon accès" });

    const target = vi.mocked(fetch).mock.calls[0]?.[0];
    expect(typeof target === "string" ? target : "").toMatch(new RegExp(`^${API_URL}/`));
    expect(stub.count("GET", "/api/v1/owner/agencies")).toBe(1);
  });
});

describe("mes accès en mode api", () => {
  const twoLinks = () => stubApi({ "GET /api/v1/owner/links": { body: LINKS_RESPONSE }, "GET /api/v1/owner/agencies": { body: { data: [ACCESS_ENTRY, SECOND_ACCESS_ENTRY] } } });

  it("liste les rattachements", async () => {
    twoLinks();
    const { container } = renderApi(<AccessesScreen />);

    const list = await screen.findByRole("list", { name: "Accès ouverts" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(within(list).getByText("Famille Dossou · Agence du Lac")).toBeTruthy();
    expect(within(list).getByText("Titulaire du mandat · relié le 02/10/2026")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Me détacher de SCI Les Palmiers · Cabinet Horizon" })).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it("détache après confirmation, retire l'accès et affiche le succès", async () => {
    const stub = twoLinks();
    stub.on("DELETE", `/api/v1/owner/links/${ACCESS_ID}`, { status: 204 });
    const { user } = renderApi(<AccessesScreen />);

    await user.click(await screen.findByRole("button", { name: "Me détacher de Famille Dossou · Agence du Lac" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Vous perdrez l’accès aux informations de Famille Dossou/)).toBeTruthy();
    expect(stub.count("DELETE", `/api/v1/owner/links/${ACCESS_ID}`)).toBe(0);

    stub.on("GET", "/api/v1/owner/links", { body: { data: [LINKS_RESPONSE.data[1]] } });
    await user.click(within(dialog).getByRole("button", { name: "Me détacher" }));

    expect(await screen.findByText("Accès retiré")).toBeTruthy();
    await waitFor(() => { expect(screen.queryByRole("dialog")).toBeNull(); });
    expect(stub.count("DELETE", `/api/v1/owner/links/${ACCESS_ID}`)).toBe(1);
    expect(within(screen.getByRole("list", { name: "Accès ouverts" })).getAllByRole("listitem")).toHaveLength(1);
  });

  it("ne détache rien quand la confirmation est annulée", async () => {
    const stub = twoLinks();
    const { user } = renderApi(<AccessesScreen />);

    await user.click(await screen.findByRole("button", { name: "Me détacher de Famille Dossou · Agence du Lac" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Annuler" }));

    await waitFor(() => { expect(screen.queryByRole("dialog")).toBeNull(); });
    expect(stub.calls.some((call) => call.method === "DELETE")).toBe(false);
    expect(screen.queryByText("Accès retiré")).toBeNull();
  });

  it("explique qu'un accès déjà retiré n'existe plus (404) et garde la boîte ouverte", async () => {
    const stub = twoLinks();
    stub.on("DELETE", `/api/v1/owner/links/${SECOND_ACCESS_ID}`, problem(404, "owner_access_not_found"));
    const { user } = renderApi(<AccessesScreen />);

    await user.click(await screen.findByRole("button", { name: "Me détacher de SCI Les Palmiers · Cabinet Horizon" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Me détacher" }));

    expect(await screen.findByText("Cet accès a déjà été retiré. La liste est mise à jour.")).toBeTruthy();
    expect(screen.queryByText("Accès retiré")).toBeNull();
  });

  it("affiche un message générique si le détachement échoue pour un code inconnu", async () => {
    const stub = twoLinks();
    stub.on("DELETE", `/api/v1/owner/links/${ACCESS_ID}`, problem(409, "nouveau_code_du_backend"));
    const { user } = renderApi(<AccessesScreen />);

    await user.click(await screen.findByRole("button", { name: "Me détacher de Famille Dossou · Agence du Lac" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Me détacher" }));

    expect(await screen.findByText("Une erreur est survenue. Réessayez dans un instant.")).toBeTruthy();
  });

  it("affiche un état vide", async () => {
    stubApi({ "GET /api/v1/owner/links": { body: { data: [] } } });
    const { container } = renderApi(<AccessesScreen />);

    expect(await screen.findByText("Aucun accès")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Me détacher/ })).toBeNull();
    await expectNoA11yViolations(container);
  });

  it("affiche l'erreur de chargement avec un bouton Réessayer", async () => {
    stubApi({ "GET /api/v1/owner/links": problem(500, "boom") });
    renderApi(<AccessesScreen />);

    expect(await screen.findByText("Vos accès n’ont pas pu être chargés")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Réessayer" })).toBeTruthy();
  });

  it("n'offre pas de réessai sur une limite de débit", async () => {
    stubApi({ "GET /api/v1/owner/links": { status: 429, body: { code: "too_many" }, headers: { "Retry-After": "45" } } });
    renderApi(<AccessesScreen />);

    expect(await screen.findByText(/Patientez 45 s/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Réessayer" })).toBeNull();
  });
});
