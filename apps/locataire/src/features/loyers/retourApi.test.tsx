import { act, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ID, LEASE_ID, onlinePayment, problem } from "@/tenant/complementsResponses.fixtures";
import { POLL_INTERVAL_MS, POLL_LIMIT } from "@/tenant/onlinePaymentQueries";
import { expectNoA11yViolations } from "../../../test/axe";
import { renderApi, stubApi } from "../../../test/api";
import { ApiPaymentReturnScreen } from "./ApiPaymentReturnScreen";

const SHOW = `GET /api/v1/tenant/online-payments/${ID.payment}`;
const CANCEL = `POST /api/v1/tenant/online-payments/${ID.payment}/cancel`;
const KEY = "eguardimmo.locataire.pendingPayment";
const open = (search = `?paiement=${ID.payment}`) => renderApi(<ApiPaymentReturnScreen />, { pathname: "/paiement/retour", search });

beforeEach(() => {
  globalThis.sessionStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("retour de paiement : suivi du statut", () => {
  it("affiche un paiement en attente avec son montant et le moyen d’annuler ou de reprendre", async () => {
    stubApi({ [SHOW]: { body: onlinePayment() } });

    const { container } = open();

    expect(await screen.findByText("Confirmation en cours")).toBeTruthy();
    expect(screen.getByText("En attente de votre paiement")).toBeTruthy();
    expect(screen.getByText("1 000 €")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Reprendre le paiement" }).getAttribute("href")).toBe(`https://pay.fake.invalid/checkout/${ID.payment}`);
    expect(screen.getByRole("button", { name: "Annuler ce paiement" })).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it("n’offre jamais de reprendre vers une adresse qui n’est pas en https", async () => {
    stubApi({ [SHOW]: { body: onlinePayment({ redirect_url: "http://pay.example/x" }) } });

    open();
    await screen.findByText("Confirmation en cours");

    expect(screen.queryByRole("link", { name: "Reprendre le paiement" })).toBeNull();
  });

  it("retrouve le paiement mémorisé quand l’adresse de retour ne porte pas d’identifiant", async () => {
    globalThis.sessionStorage.setItem(KEY, ID.payment);
    const api = stubApi({ [SHOW]: { body: onlinePayment() } });

    open("");

    expect(await screen.findByText("Confirmation en cours")).toBeTruthy();
    expect(api.count("GET", `/api/v1/tenant/online-payments/${ID.payment}`)).toBe(1);
  });

  it("accepte aussi le paramètre payment", async () => {
    stubApi({ [SHOW]: { body: onlinePayment() } });

    open(`?payment=${ID.payment}`);

    expect(await screen.findByText("Confirmation en cours")).toBeTruthy();
  });

  it("n’interroge pas le serveur avec un identifiant invalide", async () => {
    const api = stubApi();

    open("?paiement=../../me");

    expect(await screen.findByText("Aucun paiement à suivre")).toBeTruthy();
    expect(api.calls.some((call) => call.path.includes("online-payments"))).toBe(false);
  });

  it("indique qu’aucun paiement n’est à suivre sans appeler le serveur", async () => {
    const api = stubApi();

    open("");

    expect(await screen.findByText("Aucun paiement à suivre")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Voir mes paiements" }).getAttribute("href")).toBe("/loyers/paiements");
    expect(api.calls.some((call) => call.path.includes("online-payments"))).toBe(false);
  });

  it("interroge le serveur à intervalle modéré jusqu’à la confirmation puis oublie le paiement", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "setTimeout", "clearInterval", "clearTimeout", "Date"] });
    globalThis.sessionStorage.setItem(KEY, ID.payment);
    let reads = 0;
    const api = stubApi({
      [SHOW]: () => {
        reads += 1;
        return { body: reads < 3 ? onlinePayment({ status: "processing" }) : onlinePayment({ status: "succeeded", redirect_url: null, confirmed_at: "2026-11-20T10:05:00+00:00" }) };
      },
    });

    open();
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    expect(screen.getByText("Paiement en cours de traitement")).toBeTruthy();
    expect(api.count("GET", `/api/v1/tenant/online-payments/${ID.payment}`)).toBe(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS - 100); });
    expect(api.count("GET", `/api/v1/tenant/online-payments/${ID.payment}`)).toBe(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 2); });

    expect(screen.getByText("Paiement confirmé", { selector: "strong" })).toBeTruthy();
    expect(api.count("GET", `/api/v1/tenant/online-payments/${ID.payment}`)).toBe(3);
    await act(async () => { await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 5); });
    expect(api.count("GET", `/api/v1/tenant/online-payments/${ID.payment}`)).toBe(3);
    expect(globalThis.sessionStorage.getItem(KEY)).toBeNull();
    expect(screen.queryByRole("button", { name: "Annuler ce paiement" })).toBeNull();
  });

  it("cesse d’interroger au bout de la limite et prévient que la confirmation tarde", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "setTimeout", "clearInterval", "clearTimeout", "Date"] });
    const api = stubApi({ [SHOW]: { body: onlinePayment({ status: "processing" }) } });

    open();
    await act(async () => { await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * (POLL_LIMIT + 5)); });

    expect(screen.getByText("La confirmation tarde")).toBeTruthy();
    expect(api.count("GET", `/api/v1/tenant/online-payments/${ID.payment}`)).toBe(POLL_LIMIT);
  });

  it("n’offre pas d’annuler un paiement en cours de traitement", async () => {
    stubApi({ [SHOW]: { body: onlinePayment({ status: "processing", redirect_url: `https://pay.fake.invalid/c/${ID.payment}` }) } });

    open();
    await screen.findByText("Paiement en cours de traitement");

    expect(screen.queryByRole("button", { name: "Annuler ce paiement" })).toBeNull();
  });

  it("explique un échec par son code et propose de réessayer sur le bon bail", async () => {
    stubApi({ [SHOW]: { body: onlinePayment({ status: "failed", redirect_url: null, failure_code: "card_declined" }) } });

    open();

    expect(await screen.findByText("Votre carte a été refusée. Essayez une autre carte ou un autre moyen de paiement.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Réessayer" }).getAttribute("href")).toBe(`/loyers/payer?bail=${LEASE_ID}`);
    expect(screen.queryByText("Confirmation en cours")).toBeNull();
  });

  it.each([
    ["cancelled", "Paiement annulé"],
    ["expired", "Paiement expiré"],
  ])("annonce un paiement %s sans débit", async (status, title) => {
    stubApi({ [SHOW]: { body: onlinePayment({ status, redirect_url: null }) } });

    open();

    expect(await screen.findByText(title, { selector: "strong" })).toBeTruthy();
    expect(screen.getByText("Aucun montant n’a été débité.")).toBeTruthy();
  });

  it("affiche la confirmation avec la date et le lien vers les quittances", async () => {
    stubApi({ [SHOW]: { body: onlinePayment({ status: "succeeded", redirect_url: null, confirmed_at: "2026-11-20T10:05:00+00:00" }) } });

    open();

    expect(await screen.findByText("Paiement confirmé", { selector: "strong" })).toBeTruthy();
    expect(screen.getByText("Confirmé le")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Voir mes quittances" }).getAttribute("href")).toBe("/loyers/quittances");
  });

  it("signale un paiement introuvable", async () => {
    stubApi({ [SHOW]: { status: 404, body: problem(404, "online_payment_not_found", "x") } });

    open();

    expect(await screen.findByText("Ce paiement n’existe pas ou ne vous appartient pas.")).toBeTruthy();
  });
});

describe("retour de paiement : annulation", () => {
  it("annule un paiement en attente après confirmation", async () => {
    globalThis.sessionStorage.setItem(KEY, ID.payment);
    let cancelled = false;
    const api = stubApi({
      [SHOW]: () => ({ body: cancelled ? onlinePayment({ status: "cancelled", redirect_url: null }) : onlinePayment() }),
      [CANCEL]: () => {
        cancelled = true;
        return { body: onlinePayment({ status: "cancelled", redirect_url: null }) };
      },
    });

    const { user } = open();
    await user.click(await screen.findByRole("button", { name: "Annuler ce paiement" }));
    expect(api.calls.some((call) => call.method === "POST")).toBe(false);
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Annuler le paiement" }));

    await waitFor(() => { expect(api.count("POST", `/api/v1/tenant/online-payments/${ID.payment}/cancel`)).toBe(1); });
    expect(await screen.findByText("Paiement annulé", { selector: "strong" })).toBeTruthy();
    expect(globalThis.sessionStorage.getItem(KEY)).toBeNull();
  });

  it("garde le paiement quand on renonce à l’annuler", async () => {
    const api = stubApi({ [SHOW]: { body: onlinePayment() } });

    const { user } = open();
    await user.click(await screen.findByRole("button", { name: "Annuler ce paiement" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Conserver le paiement" }));

    expect(api.calls.some((call) => call.method === "POST")).toBe(false);
  });

  it("traduit le refus d’annuler un paiement qui n’est plus en attente", async () => {
    stubApi({ [SHOW]: { body: onlinePayment() }, [CANCEL]: { status: 409, body: problem(409, "payment_not_cancellable", "x") } });

    const { user } = open();
    await user.click(await screen.findByRole("button", { name: "Annuler ce paiement" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Annuler le paiement" }));

    expect(await screen.findByText("Ce paiement n’est plus en attente : il ne peut plus être annulé ici.")).toBeTruthy();
  });
});
