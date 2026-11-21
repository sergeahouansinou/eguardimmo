import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApi, stubApi } from "../../../test/api";
import { expectNoA11yViolations } from "../../../test/axe";
import { replace, currentLocation, setLocation } from "../../../test/navigation";
import { ACCESS_ENTRY, SECOND_ACCESS_ENTRY, problem } from "../responses.fixtures";
import { one, page } from "../shared/fixtures";
import { SECOND_UNIT, SECOND_UNIT_ID, UNIT, UNIT_ID } from "./fixtures";
import { PropertiesScreen } from "./PropertiesScreen";
import { PropertyScreen } from "./PropertyScreen";

vi.mock("next/navigation", async () => (await import("../../../test/navigation")).navigationMock);
vi.mock("next/link", async () => (await import("../../../test/navigation")).linkMock);

const LIST = "GET /api/v1/owner/properties";
const TWO_AGENCIES = { "GET /api/v1/owner/agencies": { body: { data: [ACCESS_ENTRY, SECOND_ACCESS_ENTRY] } } };
const DEMO_TEXTS = ["Koffi Adjovi", "Gestion Les Tilleuls", "Apt A1", "Mutuelle Horizon"];

beforeEach(() => {
  replace.mockClear();
  setLocation("/confie/biens");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("liste des biens en mode api", () => {
  it("affiche les lots confiés avec un lien vers la fiche, sans donnée de démonstration", async () => {
    const stub = stubApi({ [LIST]: { body: page([UNIT, SECOND_UNIT]) } });
    const { container } = renderApi(<PropertiesScreen />);

    const table = await screen.findByRole("table", { name: "Lots confiés à votre agence" });
    expect(within(table).getByRole("link", { name: "A1" }).getAttribute("href")).toBe(`/confie/biens/${UNIT_ID}`);
    expect(within(table).getAllByText("Résidence Les Filaos · 12 rue des Filaos, 75011 Paris")).toHaveLength(2);
    expect(within(table).getByText("Appartement")).toBeTruthy();
    expect(within(table).getByText("64,5 m²")).toBeTruthy();
    expect(within(table).getByText("Depuis le 01/01/2025")).toBeTruthy();
    expect(within(table).getByText("Du 01/06/2024 au 31/12/2026")).toBeTruthy();
    expect(within(table).getByText("Parking")).toBeTruthy();
    for (const text of DEMO_TEXTS) expect(document.body.textContent).not.toContain(text);
    expect(stub.calls.find((call) => call.path === "/api/v1/owner/properties")?.query).toEqual({});
    await expectNoA11yViolations(container);
  });

  it("charge la page suivante avec le curseur du serveur", async () => {
    const stub = stubApi({
      [LIST]: (call) => ({ body: call.query.cursor === "c2" ? page([SECOND_UNIT]) : page([UNIT], "c2") }),
    });
    const { user } = renderApi(<PropertiesScreen />);

    await user.click(await screen.findByRole("button", { name: "Afficher la suite" }));

    expect(await screen.findByRole("link", { name: "PK3" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "A1" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Afficher la suite" })).toBeNull();
    expect(stub.calls.filter((call) => call.path === "/api/v1/owner/properties").map((call) => call.query.cursor)).toEqual([undefined, "c2"]);
  });

  it("restreint à une agence, garde le choix dans l'adresse et le transmet au serveur", async () => {
    const stub = stubApi({ ...TWO_AGENCIES, [LIST]: { body: page([UNIT]) } });
    const { user } = renderApi(<PropertiesScreen />);

    await screen.findByRole("link", { name: "A1" });
    await user.click(screen.getByRole("combobox", { name: /Agence/ }));
    await user.click(await screen.findByRole("option", { name: "Cabinet Horizon" }));

    await waitFor(() => {
      expect(stub.calls.some((call) => call.path === "/api/v1/owner/properties" && call.query.agency === SECOND_ACCESS_ENTRY.agency.id)).toBe(true);
    });
    expect(currentLocation().search).toBe(`agency=${SECOND_ACCESS_ENTRY.agency.id}`);
  });

  it("reprend l'agence de l'adresse dès le premier appel", async () => {
    setLocation("/confie/biens", `agency=${ACCESS_ENTRY.agency.id}`);
    const stub = stubApi({ ...TWO_AGENCIES, [LIST]: { body: page([UNIT]) } });
    renderApi(<PropertiesScreen />);

    await screen.findByRole("link", { name: "A1" });

    expect(stub.calls.filter((call) => call.path === "/api/v1/owner/properties").every((call) => call.query.agency === ACCESS_ENTRY.agency.id)).toBe(true);
  });

  it("n'interroge pas le serveur pour une agence hors de vos accès", async () => {
    setLocation("/confie/biens", "agency=0193a5e1-0000-7000-8000-0000000000ff");
    const stub = stubApi({ ...TWO_AGENCIES, [LIST]: { body: page([UNIT]) } });
    const { user } = renderApi(<PropertiesScreen />);

    expect(await screen.findByText("Cette agence n’est plus accessible depuis votre espace.")).toBeTruthy();
    expect(stub.count("GET", "/api/v1/owner/properties")).toBe(0);

    await user.click(screen.getByRole("button", { name: "Voir toutes mes agences" }));

    expect(currentLocation().search).toBe("");
    expect(await screen.findByRole("link", { name: "A1" })).toBeTruthy();
  });

  it("affiche un état vide", async () => {
    stubApi({ [LIST]: { body: page([]) } });
    const { container } = renderApi(<PropertiesScreen />);

    expect(await screen.findByText("Aucun bien confié")).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it("traduit une limitation de débit sans proposer de réessayer", async () => {
    stubApi({ [LIST]: { ...problem(429, "too_many"), headers: { "Retry-After": "30" } } });
    renderApi(<PropertiesScreen />);

    expect(await screen.findByText("Vos biens n’ont pas pu être chargés")).toBeTruthy();
    expect(screen.getByText("Trop de demandes en peu de temps. Patientez 30 s avant de réessayer.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Réessayer" })).toBeNull();
  });

  it("propose de réessayer après une panne", async () => {
    let calls = 0;
    stubApi({ [LIST]: () => (++calls === 1 ? problem(503, "unavailable") : { body: page([UNIT]) }) });
    const { user } = renderApi(<PropertiesScreen />);

    await user.click(await screen.findByRole("button", { name: "Réessayer" }));

    expect(await screen.findByRole("link", { name: "A1" })).toBeTruthy();
  });

  it("signale une réponse qui ne respecte pas le contrat", async () => {
    stubApi({ [LIST]: { body: page([{ ...UNIT, surface_hundredths: "64,5" }]) } });
    renderApi(<PropertiesScreen />);

    expect(await screen.findByText("Le serveur a répondu de façon inattendue. Réessayez dans un instant.")).toBeTruthy();
  });
});

describe("fiche d'un lot en mode api", () => {
  it("décrit le lot et la gestion confiée", async () => {
    const stub = stubApi({ [`GET /api/v1/owner/properties/${UNIT_ID}`]: { body: one(UNIT) } });
    const { container } = renderApi(<PropertyScreen id={UNIT_ID} />);

    expect(await screen.findByRole("heading", { level: 1, name: "Lot A1" })).toBeTruthy();
    const description = screen.getByRole("region", { name: "Description du lot" });
    expect(within(description).getByText("2e étage")).toBeTruthy();
    expect(within(description).getByText("12 rue des Filaos, 75011 Paris")).toBeTruthy();
    const management = screen.getByRole("region", { name: "Gestion confiée" });
    expect(within(management).getByText("Agence du Lac")).toBeTruthy();
    expect(within(management).getByText("Famille Dossou")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Voir les baux" }).getAttribute("href")).toBe("/confie/baux");
    expect(stub.count("GET", `/api/v1/owner/properties/${UNIT_ID}`)).toBe(1);
    await expectNoA11yViolations(container);
  });

  it("explique qu'un lot hors de vos accès est introuvable", async () => {
    stubApi({ [`GET /api/v1/owner/properties/${SECOND_UNIT_ID}`]: problem(404, "owner_unit_not_found") });
    renderApi(<PropertyScreen id={SECOND_UNIT_ID} />);

    expect(await screen.findByText("Ce bien n’existe pas ou n’est plus accessible depuis votre espace.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Retour à mes biens" }).getAttribute("href")).toBe("/confie/biens");
  });
});
