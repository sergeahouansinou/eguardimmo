import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ID, LEASE_ID, onlinePayment, paymentOptions, problem } from "@/tenant/complementsResponses.fixtures";
import { leasePage, summary } from "@/tenant/responses.fixtures";
import { expectNoA11yViolations } from "../../../test/axe";
import { nav } from "../../../test/navigation";
import { renderApi, stubApi } from "../../../test/api";
import { ApiPayerScreen } from "./ApiPayerScreen";

const LEASES = { "GET /api/v1/tenant/leases": { body: leasePage([summary()]) } };
const OPTIONS = "GET /api/v1/tenant/online-payments/options";
const CREATE = "POST /api/v1/tenant/online-payments";
const PAY = /^Payer 1 000 €$/;

const assign = vi.fn<(url: string) => void>();

beforeEach(() => {
  assign.mockClear();
  vi.stubGlobal("location", { href: "http://localhost:3002/loyers/payer", assign });
  globalThis.sessionStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const stubs = (options = paymentOptions()) => ({ ...LEASES, [OPTIONS]: { body: options } });
const start = () => renderApi(<ApiPayerScreen />, { pathname: "/loyers/payer" });

describe("payer mon loyer", () => {
  it("lance l’intention avec les échéances et redirige vers la page https du prestataire", async () => {
    const api = stubApi({ ...stubs(), [CREATE]: { status: 201, body: onlinePayment() } });

    const { user, container } = start();
    await user.click(await screen.findByRole("button", { name: PAY }));

    await waitFor(() => { expect(assign).toHaveBeenCalledWith(`https://pay.fake.invalid/checkout/${ID.payment}`); });
    const call = api.calls.find((item) => item.method === "POST");
    expect(call?.path).toBe("/api/v1/tenant/online-payments");
    expect(call?.json).toMatchObject({ lease: LEASE_ID, installments: [ID.installment1, ID.installment2], method: "card" });
    expect(call?.json).toHaveProperty("client_id");
    expect(globalThis.sessionStorage.getItem("eguardimmo.locataire.pendingPayment")).toBe(ID.payment);
    await expectNoA11yViolations(container);
  });

  it("recalcule le total quand une échéance est décochée et l’envoie seule", async () => {
    const api = stubApi({ ...stubs(), [CREATE]: { status: 201, body: onlinePayment({ installment_ids: [ID.installment2] }) } });

    const { user } = start();
    await user.click(await screen.findByRole("checkbox", { name: /Échéance du 05\/10\/2026/ }));
    await user.click(await screen.findByRole("button", { name: "Payer 350 €" }));

    await waitFor(() => { expect(api.calls.some((call) => call.method === "POST")).toBe(true); });
    expect(api.calls.find((call) => call.method === "POST")?.json).toMatchObject({ installments: [ID.installment2] });
  });

  it("préselectionne l’échéance demandée dans l’adresse", async () => {
    stubApi(stubs());

    renderApi(<ApiPayerScreen />, { pathname: "/loyers/payer", search: `?echeance=${ID.installment2}` });

    expect(await screen.findByRole("button", { name: "Payer 350 €" })).toBeTruthy();
    expect(screen.getByRole<HTMLInputElement>("checkbox", { name: /Échéance du 05\/10\/2026/ }).checked).toBe(false);
  });

  it("empêche de payer sans échéance choisie", async () => {
    const api = stubApi(stubs());

    const { user } = start();
    await user.click(await screen.findByRole("checkbox", { name: /Échéance du 05\/10\/2026/ }));
    await user.click(screen.getByRole("checkbox", { name: /Échéance du 05\/11\/2026/ }));

    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Payer" }).disabled).toBe(true);
    expect(api.calls.some((call) => call.method === "POST")).toBe(false);
  });

  it("ne demande aucune donnée de carte ni de compte dans notre page", async () => {
    stubApi(stubs());

    start();
    await screen.findByRole("button", { name: PAY });

    const inputs = Array.from(document.querySelectorAll("input"));
    expect(inputs.length).toBeGreaterThan(0);
    for (const input of inputs) expect(["checkbox", "radio"]).toContain(input.type);
    expect(document.querySelector('[autocomplete^="cc-"]')).toBeNull();
    expect(document.querySelector("iframe")).toBeNull();
    expect(screen.getByText(/Aucune donnée de carte ou de compte n’est saisie ni conservée/)).toBeTruthy();
  });

  it("refuse de rediriger vers une adresse qui n’est pas en https et propose de suivre le paiement", async () => {
    stubApi({ ...stubs(), [CREATE]: { status: 201, body: onlinePayment({ redirect_url: "http://pay.example/checkout" }) } });

    const { user } = start();
    await user.click(await screen.findByRole("button", { name: PAY }));

    expect(await screen.findByText("Page de paiement indisponible")).toBeTruthy();
    expect(assign).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Suivre ou annuler ce paiement" }).getAttribute("href")).toBe(`/paiement/retour?paiement=${ID.payment}`);
  });

  it("ne suit pas une adresse https dont l’hôte n’est pas autorisé", async () => {
    stubApi({ ...stubs(), [CREATE]: { status: 201, body: onlinePayment({ redirect_url: "https://evil.example/checkout" }) } });

    const { user } = start();
    await user.click(await screen.findByRole("button", { name: PAY }));

    expect(await screen.findByText("Page de paiement indisponible")).toBeTruthy();
    expect(assign).not.toHaveBeenCalled();
  });

  it.each(["javascript:alert(1)", "https://user:secret@pay.example/x", "pay.example/x"])("ne suit jamais l’adresse %s", async (url) => {
    stubApi({ ...stubs(), [CREATE]: { status: 201, body: onlinePayment({ redirect_url: url }) } });

    const { user } = start();
    await user.click(await screen.findByRole("button", { name: PAY }));

    expect(await screen.findByText("Page de paiement indisponible")).toBeTruthy();
    expect(assign).not.toHaveBeenCalled();
  });

  it("renvoie vers le suivi quand l’intention rejouée n’est plus en cours", async () => {
    stubApi({ ...stubs(), [CREATE]: { body: onlinePayment({ status: "succeeded", redirect_url: null, confirmed_at: "2026-11-20T10:05:00+00:00" }) } });

    const { user } = start();
    await user.click(await screen.findByRole("button", { name: PAY }));

    await waitFor(() => { expect(nav.push).toHaveBeenCalledWith(`/paiement/retour?paiement=${ID.payment}`); });
    expect(assign).not.toHaveBeenCalled();
  });

  it.each([
    ["provider_unavailable", /Le paiement en ligne n’est pas encore ouvert/],
    ["account_not_ready", /Votre agence n’a pas encore activé le paiement en ligne/],
    ["nothing_due", /Aucune échéance n’est à régler pour ce bail/],
    ["payment_in_progress", /Un paiement en ligne est déjà en cours pour ce bail/],
  ])("explique l’indisponibilité %s sans proposer de payer", async (reason, message) => {
    stubApi(stubs(paymentOptions({ available: false, unavailable_reason: reason, methods: [], installments: [], total: null })));

    start();

    expect(await screen.findByText("Paiement en ligne indisponible")).toBeTruthy();
    expect(screen.getByText(message)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Payer/ })).toBeNull();
  });

  it.each([
    [409, "payment_installments_in_progress", /Un paiement est déjà en cours pour l’une de ces échéances/],
    [409, "payment_nothing_due", /Aucune des échéances choisies n’a de reste dû/],
    [409, "payment_account_not_ready", /Votre agence n’a pas encore activé le paiement en ligne/],
    [503, "payment_provider_unavailable", /Le service de paiement ne répond pas : rien n’a été débité/],
    [422, "payment_method_unsupported", /Ce moyen de paiement n’est pas encore proposé/],
  ])("traduit l’erreur %i %s du serveur", async (status, code, message) => {
    stubApi({ ...stubs(), [CREATE]: { status, body: problem(status, code, "x") } });

    const { user } = start();
    await user.click(await screen.findByRole("button", { name: PAY }));

    expect(await screen.findByText(message)).toBeTruthy();
    expect(assign).not.toHaveBeenCalled();
  });

  it("rejoue avec le même identifiant après une panne et en change si la sélection change", async () => {
    let attempt = 0;
    const api = stubApi({
      ...stubs(),
      [CREATE]: () => {
        attempt += 1;
        return attempt < 3 ? { status: 503, body: problem(503, "payment_provider_unavailable", "x") } : { status: 201, body: onlinePayment() };
      },
    });

    const { user } = start();
    await user.click(await screen.findByRole("button", { name: PAY }));
    await screen.findByText(/Le service de paiement ne répond pas/);
    await user.click(screen.getByRole("button", { name: PAY }));
    await waitFor(() => { expect(api.calls.filter((call) => call.method === "POST")).toHaveLength(2); });
    await user.click(screen.getByRole("checkbox", { name: /Échéance du 05\/10\/2026/ }));
    await user.click(screen.getByRole("button", { name: "Payer 350 €" }));
    await waitFor(() => { expect(api.calls.filter((call) => call.method === "POST")).toHaveLength(3); });

    const ids = api.calls.filter((call) => call.method === "POST").map((call) => (call.json as { client_id: string }).client_id);
    expect(ids[0]).toBe(ids[1]);
    expect(ids[2]).not.toBe(ids[0]);
  });

  it("signale une panne du serveur sur les options", async () => {
    stubApi({ ...LEASES, [OPTIONS]: { status: 500, body: problem(500, "server_error", "Boom") } });

    start();

    expect(await screen.findByText("Le paiement n’a pas pu être préparé")).toBeTruthy();
  });

  it("ne propose rien d’autre que la carte quand le serveur n’en liste pas d’autre", async () => {
    stubApi(stubs());

    start();
    await screen.findByRole("button", { name: PAY });

    const methods = screen.getByRole("group", { name: "Moyen de paiement" });
    expect(within(methods).getAllByRole("radio")).toHaveLength(1);
  });
});
