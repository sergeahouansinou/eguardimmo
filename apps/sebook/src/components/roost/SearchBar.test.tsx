import { screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MARKETPLACE, renderApp, stubApi } from "../../../test/api";
import { expectNoA11yViolations } from "../../../test/axe";
import { nav } from "../../../test/navigation";
import { PLACES } from "@/marketplace/responses.fixtures";
import SearchBar from "./SearchBar";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2027-03-05T10:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const lastHref = () => new URL(nav.push.mock.calls.at(-1)?.[0] ?? "", "http://sebook.test");

describe("Barre de recherche Roost", () => {
  it("compose lieu, dates et voyageurs puis navigue vers /destinations", async () => {
    const api = stubApi({ [`GET ${MARKETPLACE}/places`]: { body: PLACES } });
    const { user, container } = renderApp(<SearchBar />);

    await user.click(screen.getByText("Destination").closest("button") as HTMLElement);
    await user.type(screen.getByRole("textbox", { name: "Destination" }), "Ly");
    await user.click(await screen.findByRole("button", { name: "Lyon (69000)" }));
    expect(api.last("GET", `${MARKETPLACE}/places`)?.query.get("q")).toBe("Ly");

    await user.click(await screen.findByRole("button", { name: "20 mars 2027" }));
    await user.click(screen.getByRole("button", { name: "22 mars 2027" }));
    expect(screen.getByRole("button", { name: "Plus de voyageurs" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Plus de voyageurs" }));
    await user.click(screen.getByRole("button", { name: "Plus de voyageurs" }));
    await expectNoA11yViolations(container);

    await user.click(screen.getByRole("button", { name: "Rechercher" }));
    const href = lastHref();
    expect(href.pathname).toBe("/destinations");
    expect(Object.fromEntries(href.searchParams)).toEqual({ place: "lyon", arrivee: "2027-03-20", depart: "2027-03-22", voyageurs: "2" });
  });

  it("sans critère, ouvre la liste complète et n’envoie aucun filtre", async () => {
    stubApi();
    const { user } = renderApp(<SearchBar />);
    await user.click(screen.getByRole("button", { name: "Rechercher" }));
    expect(lastHref().pathname + lastHref().search).toBe("/destinations");
  });

  it("une date de départ antérieure à l’arrivée redémarre la sélection", async () => {
    stubApi();
    const { user } = renderApp(<SearchBar />);
    await user.click(screen.getByText("Arrivée").closest("button") as HTMLElement);
    await user.click(await screen.findByRole("button", { name: "20 mars 2027" }));
    await user.click(screen.getByRole("button", { name: "10 mars 2027" }));
    await user.click(screen.getByRole("button", { name: "Rechercher" }));
    expect(lastHref().searchParams.get("arrivee")).toBeNull();
  });

  it("n’autorise pas les jours passés", async () => {
    stubApi();
    const { user } = renderApp(<SearchBar />);
    await user.click(screen.getByText("Arrivée").closest("button") as HTMLElement);
    const past = await screen.findByRole("button", { name: "4 mars 2027" });
    expect(past.hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Mois précédent" }).hasAttribute("disabled")).toBe(true);
  });

  it("annonce l’indisponibilité des suggestions plutôt qu’une absence de résultat", async () => {
    stubApi({ [`GET ${MARKETPLACE}/places`]: { status: 500, body: {} } });
    const { user } = renderApp(<SearchBar />);
    await user.click(screen.getByText("Destination").closest("button") as HTMLElement);
    await user.type(screen.getByRole("textbox", { name: "Destination" }), "Ly");
    expect(await screen.findByText("Suggestions indisponibles pour le moment.")).toBeTruthy();
    expect(screen.queryByText("Aucun lieu trouvé.")).toBeNull();
  });

  it("le tiroir mobile reprend les mêmes champs et se ferme à la recherche", async () => {
    stubApi({ [`GET ${MARKETPLACE}/places`]: { body: PLACES } });
    const { user } = renderApp(<SearchBar scope="long_term" />);
    await user.click(screen.getByText("Destination ?").closest("button") as HTMLElement);
    const drawer = screen.getByRole("dialog", { name: "Rechercher un logement" });
    await user.type(within(drawer).getByRole("textbox", { name: "Destination" }), "Li");
    await user.click(await within(drawer).findByRole("button", { name: "Lille (59000)" }));
    await user.click(within(drawer).getByRole("button", { name: "Rechercher" }));
    expect(lastHref().searchParams.get("portee")).toBe("longue-duree");
    expect(lastHref().searchParams.get("place")).toBe("lille");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
