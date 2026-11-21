import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  INTERVENTION_IDS as IDS,
  fileUploaded,
  openDetail,
  reportOptions,
  reportOptionsTwoLeases,
  tooManyOpenProblem,
} from "@/tenant/interventionResponses.fixtures";
import { expectNoA11yViolations } from "../../../test/axe";
import { nav } from "../../../test/navigation";
import { renderApi, stubApi } from "../../../test/api";
import { ApiNouvelleScreen } from "./ApiNouvelleScreen";
import { choose } from "../rent/testKit";

const BASE = "/api/v1/tenant/interventions";
const OPTIONS = `${BASE}/options`;
const routes = () => ({ [`GET ${OPTIONS}`]: { body: reportOptions } });
const firstLease = reportOptions.data[0];
const UNIT_LABEL = firstLease?.units[0]?.label ?? "";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function fillForm(user: ReturnType<typeof renderApi>["user"]) {
  await screen.findByRole("combobox", { name: /Type de problème/ });
  await waitFor(() => { expect(screen.getByRole("combobox", { name: /Type de problème/ }).hasAttribute("disabled")).toBe(false); });
  await choose(user, "Type de problème", "Plomberie");
  await choose(user, "Lieu", UNIT_LABEL);
  await user.type(screen.getByLabelText("Titre *"), "Fuite sous l’évier");
  await user.type(screen.getByLabelText("Description *"), "De l’eau coule du siphon.");
}

describe("signalement d’un problème (api)", () => {
  it("lit les choix du formulaire sur la route dédiée, sans passer par la liste des baux", async () => {
    const stub = stubApi(routes());

    renderApi(<ApiNouvelleScreen />, { pathname: "/interventions/nouvelle" });

    await screen.findByRole("combobox", { name: /Type de problème/ });
    expect(stub.count("GET", OPTIONS)).toBe(1);
    expect(stub.calls.some((call) => call.path === "/api/v1/tenant/leases")).toBe(false);
    expect(screen.queryByRole("combobox", { name: /Bail concerné/ })).toBeNull();
  });

  it("propose les parties communes quand le serveur les autorise", async () => {
    stubApi(routes());

    const { user } = renderApi(<ApiNouvelleScreen />, { pathname: "/interventions/nouvelle" });
    await screen.findByRole("combobox", { name: /Lieu/ });
    await user.click(screen.getByRole("combobox", { name: /Lieu/ }));

    expect(await screen.findByRole("option", { name: "Parties communes" })).toBeTruthy();
    expect(screen.getByRole("option", { name: UNIT_LABEL })).toBeTruthy();
  });

  it("n’affiche pas les parties communes quand le serveur ne les autorise pas", async () => {
    stubApi({ [`GET ${OPTIONS}`]: { body: { data: reportOptions.data.map((lease) => ({ ...lease, common_area_allowed: false })) } } });

    const { user } = renderApi(<ApiNouvelleScreen />, { pathname: "/interventions/nouvelle" });
    await screen.findByRole("combobox", { name: /Lieu/ });
    await user.click(screen.getByRole("combobox", { name: /Lieu/ }));

    expect(await screen.findByRole("option", { name: UNIT_LABEL })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Parties communes" })).toBeNull();
  });

  it("demande le bail quand il y en a plusieurs et envoie le bail choisi", async () => {
    const [first, second] = reportOptionsTwoLeases.data;
    const stub = stubApi({
      [`GET ${OPTIONS}`]: { body: reportOptionsTwoLeases },
      [`POST ${BASE}`]: { status: 201, body: openDetail },
    });

    const { user } = renderApi(<ApiNouvelleScreen />, { pathname: "/interventions/nouvelle" });
    await screen.findByRole("combobox", { name: /Bail concerné/ });
    await choose(user, "Bail concerné", second?.label ?? "");
    await choose(user, "Type de problème", "Plomberie");
    await choose(user, "Lieu", second?.units[0]?.label ?? "");
    await user.type(screen.getByLabelText("Titre *"), "Fuite sous l’évier");
    await user.type(screen.getByLabelText("Description *"), "De l’eau coule du siphon.");
    await user.click(screen.getByRole("button", { name: "Envoyer le signalement" }));

    await waitFor(() => { expect(nav.push).toHaveBeenCalledWith(`/interventions/${IDS.open}`); });
    const create = stub.calls.find((call) => call.method === "POST" && call.path === BASE);
    expect(create?.json).toMatchObject({ lease_id: second?.lease_id, unit_id: second?.units[0]?.id });
    expect(second?.lease_id).not.toBe(first?.lease_id);
  });

  it("explique qu’aucun bail en cours ne permet de signaler", async () => {
    stubApi({ [`GET ${OPTIONS}`]: { body: { data: [] } } });

    renderApi(<ApiNouvelleScreen />, { pathname: "/interventions/nouvelle" });

    expect(await screen.findByText("Aucun bail en cours")).toBeTruthy();
  });

  it("refuse une réponse des choix hors contrat", async () => {
    stubApi({ [`GET ${OPTIONS}`]: { body: { data: { natures: [], units: [] } } } });

    renderApi(<ApiNouvelleScreen />, { pathname: "/interventions/nouvelle" });

    expect(await screen.findByText("Les choix du formulaire n’ont pas pu être chargés")).toBeTruthy();
  });

  it("valide les champs obligatoires sans appeler le serveur", async () => {
    const stub = stubApi(routes());

    const { user, container } = renderApi(<ApiNouvelleScreen />, { pathname: "/interventions/nouvelle" });

    await user.click(await screen.findByRole("button", { name: "Envoyer le signalement" }));

    expect(await screen.findByText("Choisissez un type de problème.")).toBeTruthy();
    expect(screen.getByText("Choisissez le lieu du problème.")).toBeTruthy();
    expect(screen.getByText("Le titre doit faire au moins 3 caractères.")).toBeTruthy();
    expect(stub.count("POST", BASE)).toBe(0);
    await expectNoA11yViolations(container);
  });

  it("envoie le signalement avec une clé d’idempotence puis joint les photos", async () => {
    const stub = stubApi({
      ...routes(),
      [`POST ${BASE}`]: { status: 201, body: openDetail },
      [`POST ${BASE}/${IDS.open}/files`]: { status: 201, body: fileUploaded },
    });

    const { user } = renderApi(<ApiNouvelleScreen />, { pathname: "/interventions/nouvelle" });
    await fillForm(user);
    await user.upload(screen.getByLabelText("Joindre des photos"), [new File(["a"], "a.jpg", { type: "image/jpeg" }), new File(["b"], "b.png", { type: "image/png" })]);
    await user.click(screen.getByRole("button", { name: "Envoyer le signalement" }));

    await waitFor(() => { expect(nav.push).toHaveBeenCalledWith(`/interventions/${IDS.open}`); });
    const create = stub.calls.find((call) => call.method === "POST" && call.path === BASE);
    expect(create?.headers["idempotency-key"]).toMatch(/^[A-Za-z0-9._:-]{8,64}$/);
    expect(create?.json).toEqual({
      lease_id: IDS.lease,
      unit_id: IDS.unit,
      common_area: false,
      nature_term_id: IDS.nature,
      title: "Fuite sous l’évier",
      description: "De l’eau coule du siphon.",
      room: null,
      reported_urgency: "soon",
      availability: null,
    });
    expect(stub.count("POST", `${BASE}/${IDS.open}/files`)).toBe(2);
  });

  it("garde le signalement créé et signale les photos refusées", async () => {
    const stub = stubApi({
      ...routes(),
      [`POST ${BASE}`]: { status: 201, body: openDetail },
      [`POST ${BASE}/${IDS.open}/files`]: { status: 422, body: { type: "x", title: "x", status: 422, detail: "x", code: "intervention_file_invalid" } },
    });

    const { user } = renderApi(<ApiNouvelleScreen />, { pathname: "/interventions/nouvelle" });
    await fillForm(user);
    await user.upload(screen.getByLabelText("Joindre des photos"), new File(["a"], "a.jpg", { type: "image/jpeg" }));
    await user.click(screen.getByRole("button", { name: "Envoyer le signalement" }));

    await waitFor(() => { expect(nav.push).toHaveBeenCalledWith(`/interventions/${IDS.open}`); });
    expect(stub.count("POST", BASE)).toBe(1);
  });

  it("rejoue la même clé après un échec réseau, sans créer de doublon", async () => {
    let attempts = 0;
    const stub = stubApi({
      ...routes(),
      [`POST ${BASE}`]: () => {
        attempts += 1;
        return attempts === 1 ? { status: 503, body: { type: "x", title: "x", status: 503, detail: "x", code: "service_unavailable" } } : { status: 200, body: openDetail };
      },
    });

    const { user } = renderApi(<ApiNouvelleScreen />, { pathname: "/interventions/nouvelle" });
    await fillForm(user);
    await user.click(screen.getByRole("button", { name: "Envoyer le signalement" }));
    expect((await screen.findByRole("alert")).textContent).toContain("momentanément indisponible");
    await user.click(screen.getByRole("button", { name: "Envoyer le signalement" }));

    await waitFor(() => { expect(nav.push).toHaveBeenCalledWith(`/interventions/${IDS.open}`); });
    const keys = stub.calls.filter((call) => call.method === "POST" && call.path === BASE).map((call) => call.headers["idempotency-key"]);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });

  it("change de clé quand le contenu change", async () => {
    const stub = stubApi({
      ...routes(),
      [`POST ${BASE}`]: { status: 503, body: { type: "x", title: "x", status: 503, detail: "x", code: "service_unavailable" } },
    });

    const { user } = renderApi(<ApiNouvelleScreen />, { pathname: "/interventions/nouvelle" });
    await fillForm(user);
    await user.click(screen.getByRole("button", { name: "Envoyer le signalement" }));
    await screen.findByRole("alert");
    await user.type(screen.getByLabelText("Titre *"), " bis");
    await user.click(screen.getByRole("button", { name: "Envoyer le signalement" }));

    await waitFor(() => { expect(stub.count("POST", BASE)).toBe(2); });
    const keys = stub.calls.filter((call) => call.method === "POST" && call.path === BASE).map((call) => call.headers["idempotency-key"]);
    expect(keys[0]).not.toBe(keys[1]);
  });

  it("traduit le plafond de demandes ouvertes", async () => {
    stubApi({ ...routes(), [`POST ${BASE}`]: { status: 422, body: tooManyOpenProblem } });

    const { user } = renderApi(<ApiNouvelleScreen />, { pathname: "/interventions/nouvelle" });
    await fillForm(user);
    await user.click(screen.getByRole("button", { name: "Envoyer le signalement" }));

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(/beaucoup de demandes ouvertes/)).toBeTruthy();
  });

  it("refuse une photo trop lourde ou d’un mauvais format avant l’envoi", async () => {
    stubApi(routes());

    renderApi(<ApiNouvelleScreen />, { pathname: "/interventions/nouvelle" });
    await screen.findByRole("button", { name: "Envoyer le signalement" });
    fireEvent.change(screen.getByLabelText("Joindre des photos"), { target: { files: [new File(["a"], "doc.gif", { type: "image/gif" })] } });

    expect((await screen.findByRole("alert")).textContent).toContain("doc.gif");
  });
});
