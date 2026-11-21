import { screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApi, stubApi } from "../../../test/api";
import { expectNoA11yViolations } from "../../../test/axe";
import { push, setLocation } from "../../../test/navigation";
import { ACCESS_ENTRY, SECOND_ACCESS_ENTRY, problem } from "../responses.fixtures";
import { page } from "../shared/fixtures";
import { PAYOUTS_RESPONSE, RENT_RESPONSE } from "./fixtures";
import { LoyersScreen, RentMonthScreen } from "./RentScreens";

vi.mock("next/navigation", async () => (await import("../../../test/navigation")).navigationMock);
vi.mock("next/link", async () => (await import("../../../test/navigation")).linkMock);

const RENT = "GET /api/v1/owner/rent/2026-11";
const PAYOUTS = "GET /api/v1/owner/payouts";
const TWO_AGENCIES = { "GET /api/v1/owner/agencies": { body: { data: [ACCESS_ENTRY, SECOND_ACCESS_ENTRY] } } };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 19, 10, 0, 0));
  push.mockClear();
  setLocation("/confie/loyers");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("loyers du mois en mode api", () => {
  it("présente un bloc par agence et par mandat, chacun dans sa devise, avec les totaux du serveur", async () => {
    stubApi({ ...TWO_AGENCIES, [RENT]: { body: RENT_RESPONSE } });
    const { container } = renderApi(<RentMonthScreen month="2026-11" />);

    const first = await screen.findByRole("region", { name: "Famille Dossou · Agence du Lac" });
    const second = screen.getByRole("region", { name: "SCI Les Palmiers · Cabinet Horizon" });
    const firstTable = within(first).getByRole("table", { name: "Loyers de Famille Dossou chez Agence du Lac" });
    expect(within(firstTable).getByText("1 200 €")).toBeTruthy();
    expect(within(firstTable).getByText("708 €")).toBeTruthy();
    expect(within(firstTable).getByText("300 €")).toBeTruthy();
    expect(within(first).getByText("Titulaire du mandat · montants en EUR")).toBeTruthy();
    const secondTable = within(second).getByRole("table", { name: "Loyers de SCI Les Palmiers chez Cabinet Horizon" });
    expect(within(secondTable).getAllByText("250 000 F CFA").length).toBeGreaterThan(0);
    expect(within(secondTable).getAllByText("230 000 F CFA")).toHaveLength(2);
    expect(screen.getAllByText("Total de ce mandat")).toHaveLength(2);
    expect(screen.getByText("Chaque mandat est présenté dans sa devise : aucun total n’additionne deux agences ni deux devises.")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/Total général|Tous mandats/);
    await expectNoA11yViolations(container);
  });

  it("transmet l'agence au serveur", async () => {
    setLocation("/confie/loyers/2026-11", `agency=${SECOND_ACCESS_ENTRY.agency.id}`);
    const stub = stubApi({ ...TWO_AGENCIES, [RENT]: { body: { data: { ...RENT_RESPONSE.data, mandants: [RENT_RESPONSE.data.mandants[1]] } } } });
    renderApi(<RentMonthScreen month="2026-11" />);

    await screen.findByRole("region", { name: "SCI Les Palmiers · Cabinet Horizon" });

    expect(stub.calls.find((call) => call.path === "/api/v1/owner/rent/2026-11")?.query).toEqual({ agency: SECOND_ACCESS_ENTRY.agency.id });
  });

  it("change de mois en gardant l'agence", async () => {
    setLocation("/confie/loyers/2026-11", `agency=${ACCESS_ENTRY.agency.id}`);
    stubApi({ ...TWO_AGENCIES, [RENT]: { body: RENT_RESPONSE } });
    vi.useRealTimers();
    const { user } = renderApi(<RentMonthScreen month="2026-11" />);

    await screen.findByRole("region", { name: "Famille Dossou · Agence du Lac" });
    await user.click(screen.getByRole("combobox", { name: /Mois/ }));
    await user.click(await screen.findByRole("option", { name: "Octobre 2026" }));

    expect(push).toHaveBeenCalledWith(`/confie/loyers/2026-10?agency=${ACCESS_ENTRY.agency.id}`);
  });

  it("affiche un état vide quand aucun mandat ne couvre le mois", async () => {
    stubApi({ [RENT]: { body: { data: { month: "2026-11", mandants: [] } } } });
    renderApi(<RentMonthScreen month="2026-11" />);

    expect(await screen.findByText("Aucun loyer pour ce mois")).toBeTruthy();
  });

  it("traduit un mois introuvable par le serveur", async () => {
    stubApi({ [RENT]: problem(404, "not_found") });
    renderApi(<RentMonthScreen month="2026-11" />);

    expect(await screen.findByText("Les loyers du mois n’ont pas pu être chargés")).toBeTruthy();
    expect(screen.getByText("Cet élément n’existe pas ou n’est plus accessible depuis votre espace.")).toBeTruthy();
  });
});

describe("reversements en mode api", () => {
  it("affiche le prochain virement indicatif, le motif neutre et la liste des reversements", async () => {
    stubApi({ ...TWO_AGENCIES, [RENT]: { body: RENT_RESPONSE }, [PAYOUTS]: { body: page(PAYOUTS_RESPONSE.data, null, { upcoming: PAYOUTS_RESPONSE.upcoming }) } });
    const { container } = renderApi(<LoyersScreen />);

    const upcoming = await screen.findByRole("region", { name: "Prochain reversement" });
    expect(await within(upcoming).findByText(/Prévu autour du 05\/12\/2026 \(indicatif\)/)).toBeTruthy();
    expect(within(upcoming).getByText(/Aucun compte de versement n'est enregistré/)).toBeTruthy();
    expect(within(upcoming).getByText(/Date non communiquée/)).toBeTruthy();
    const table = await screen.findByRole("table", { name: "Reversements" });
    expect(within(table).getByText("RV-2026-0007")).toBeTruthy();
    expect(within(table).getByText("Versé")).toBeTruthy();
    expect(within(table).getByText("Programmé")).toBeTruthy();
    expect(within(table).getByText("Retourné par la banque")).toBeTruthy();
    expect(within(table).getAllByText("•••• 1234")).toHaveLength(2);
    expect(within(table).getByText("230 000 F CFA")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1, name: "Loyers et reversements" })).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it("n'annonce pas de reversement à venir quand le serveur n'en donne pas", async () => {
    stubApi({ [RENT]: { body: RENT_RESPONSE }, [PAYOUTS]: { body: page([], null, { upcoming: [] }) } });
    renderApi(<LoyersScreen />);

    expect(await screen.findByText("Aucun reversement à venir pour le moment.")).toBeTruthy();
    expect(await screen.findByText("Aucun reversement")).toBeTruthy();
  });

  it("explique à un co-indivisaire que les reversements ne le concernent pas", async () => {
    stubApi({
      "GET /api/v1/owner/agencies": { body: { data: [{ ...ACCESS_ENTRY, role: "co_owner", read_only: true }] } },
      [RENT]: { body: RENT_RESPONSE },
      [PAYOUTS]: { body: page([], null, { upcoming: [] }) },
    });
    renderApi(<LoyersScreen />);

    expect(await screen.findByText("Reversements non visibles")).toBeTruthy();
  });

  it("charge la suite des reversements avec le curseur", async () => {
    vi.useRealTimers();
    const stub = stubApi({
      [RENT]: { body: RENT_RESPONSE },
      [PAYOUTS]: (call) => ({ body: call.query.cursor === "p2" ? page([PAYOUTS_RESPONSE.data[2]], null, { upcoming: [] }) : page([PAYOUTS_RESPONSE.data[0]], "p2", { upcoming: PAYOUTS_RESPONSE.upcoming }) }),
    });
    const { user } = renderApi(<LoyersScreen />);

    await user.click(await screen.findByRole("button", { name: "Afficher la suite" }));

    expect(await screen.findByText("RV-2026-0006")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Prochain reversement" })).getAllByRole("listitem")).toHaveLength(2);
    expect(stub.calls.filter((call) => call.path === "/api/v1/owner/payouts").map((call) => call.query.cursor)).toEqual([undefined, "p2"]);
  });

  it("signale une réponse hors contrat sur le statut du montant", async () => {
    stubApi({ [RENT]: { body: RENT_RESPONSE }, [PAYOUTS]: { body: page([{ ...PAYOUTS_RESPONSE.data[0], amount: { amount: "64400", currency: "EUR" } }], null, { upcoming: [] }) } });
    renderApi(<LoyersScreen />);

    expect(await screen.findByText("Vos reversements n’ont pas pu être chargés")).toBeTruthy();
  });
});
