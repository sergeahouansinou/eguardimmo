import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ID, LEASE_ID, noticeOptions, noticeRequest, page, problem } from "@/tenant/complementsResponses.fixtures";
import { LEASE_LOIRE_ID, leasePage, summary } from "@/tenant/responses.fixtures";
import { expectNoA11yViolations } from "../../../test/axe";
import { renderApi, stubApi } from "../../../test/api";
import { captureDownloads } from "../rent/testKit";
import { ApiCongeScreen } from "./ApiCongeScreen";

const LEASES = { "GET /api/v1/tenant/leases": { body: leasePage([summary()]) } };
const OPTIONS = `GET /api/v1/tenant/leases/${LEASE_ID}/notice-options`;
const LIST = "GET /api/v1/tenant/notice-requests";
const SUBMIT = `POST /api/v1/tenant/leases/${LEASE_ID}/notice-requests`;
const WITHDRAW = `DELETE /api/v1/tenant/notice-requests/${ID.notice}`;
const LETTER = `GET /api/v1/tenant/notice-requests/${ID.notice}/letter`;
const STANDARD = "Préavis standard · préavis de 3 mois";
const JOB_LOSS = "Perte d’emploi · préavis de 1 mois";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 20, 10, 0, 0));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const stubs = (options = noticeOptions(), requests: unknown[] = []) => ({ ...LEASES, [OPTIONS]: { body: options }, [LIST]: { body: page(requests) } });
const pdf = (name = "justificatif.pdf") => new File(["%PDF-1.4"], name, { type: "application/pdf" });
async function pick(user: ReturnType<typeof renderApi>["user"], option: string) {
  await user.click(await screen.findByRole("combobox", { name: /Motif du préavis/ }));
  await user.click(await screen.findByRole("option", { name: option }));
}
const departure = () => screen.getByLabelText(/Date de départ souhaitée/);

async function confirmSend(user: ReturnType<typeof renderApi>["user"]) {
  await user.click(screen.getByRole("button", { name: "Transmettre ma demande" }));
  const dialog = await screen.findByRole("dialog");
  await user.click(within(dialog).getByRole("button", { name: "Transmettre ma demande" }));
}

describe("donner congé : demande", () => {
  it("transmet la demande après confirmation avec les champs attendus par le serveur", async () => {
    const api = stubApi({ ...stubs(), [SUBMIT]: { status: 201, body: { data: noticeRequest() } } });

    const { user, container } = renderApi(<ApiCongeScreen />, { pathname: "/bail/conge" });
    await pick(user, STANDARD);
    expect((departure() as HTMLInputElement).value).toBe("2027-02-20");
    fireEvent.change(departure(), { target: { value: "2027-02-28" } });
    await user.click(screen.getByRole("checkbox"));
    await expectNoA11yViolations(container);
    await user.click(screen.getByRole("button", { name: "Transmettre ma demande" }));
    expect(api.count("POST", `/api/v1/tenant/leases/${LEASE_ID}/notice-requests`)).toBe(0);
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Transmettre ma demande" }));

    await waitFor(() => { expect(api.count("POST", `/api/v1/tenant/leases/${LEASE_ID}/notice-requests`)).toBe(1); });
    const call = api.calls.find((item) => item.method === "POST");
    expect(call?.fields).toMatchObject({ reason_key: "standard", requested_departure_on: "2027-02-28", consent_accepted: "1", consent_version: "2026-11-v1" });
    expect(call?.fields.client_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(call?.fields.forwarding_address).toBeUndefined();
    expect(call?.files.proof).toBeUndefined();
    expect(await screen.findByText("Demande de congé transmise")).toBeTruthy();
  });

  it("décrit ce que fait le serveur sans parler de lettre recommandée électronique", async () => {
    stubApi(stubs());

    renderApi(<ApiCongeScreen />, { pathname: "/bail/conge" });
    await screen.findByLabelText("Adresse (facultatif)");

    expect(document.body.textContent).not.toMatch(/recommandée électronique/i);
    expect(screen.getByText(/en accuse réception à une date certaine/)).toBeTruthy();
  });

  it("joint l’adresse de réexpédition quand elle est saisie", async () => {
    const api = stubApi({ ...stubs(), [SUBMIT]: { status: 201, body: { data: noticeRequest() } } });

    const { user } = renderApi(<ApiCongeScreen />, { pathname: "/bail/conge" });
    await pick(user, STANDARD);
    await user.type(screen.getByLabelText("Adresse (facultatif)"), "22 avenue Jean Jaurès, 69007 Lyon");
    await user.click(screen.getByRole("checkbox"));
    await confirmSend(user);

    await waitFor(() => { expect(api.calls.some((call) => call.method === "POST")).toBe(true); });
    expect(api.calls.find((call) => call.method === "POST")?.fields.forwarding_address).toBe("22 avenue Jean Jaurès, 69007 Lyon");
  });

  it("exige un justificatif quand le motif le demande puis l’envoie", async () => {
    const api = stubApi({ ...stubs(), [SUBMIT]: { status: 201, body: { data: noticeRequest({ reason_key: "job_loss", has_proof: true }) } } });

    const { user } = renderApi(<ApiCongeScreen />, { pathname: "/bail/conge" });
    await pick(user, JOB_LOSS);
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Transmettre ma demande" }));
    expect(await screen.findByText("Ce motif exige un justificatif : joignez-le.")).toBeTruthy();
    expect(api.calls.some((call) => call.method === "POST")).toBe(false);

    await user.upload(screen.getByLabelText("Joindre le justificatif du motif"), pdf());
    await confirmSend(user);

    await waitFor(() => { expect(api.calls.some((call) => call.method === "POST")).toBe(true); });
    expect(api.calls.find((call) => call.method === "POST")?.files.proof).toEqual(["justificatif.pdf"]);
  });

  it("ne demande aucun justificatif pour un motif qui n’en exige pas", async () => {
    stubApi(stubs());

    const { user } = renderApi(<ApiCongeScreen />, { pathname: "/bail/conge" });
    await pick(user, STANDARD);

    expect(screen.queryByLabelText("Joindre le justificatif du motif")).toBeNull();
  });

  it("refuse une date de départ antérieure à la fin du préavis", async () => {
    const api = stubApi(stubs());

    const { user } = renderApi(<ApiCongeScreen />, { pathname: "/bail/conge" });
    await pick(user, STANDARD);
    fireEvent.change(departure(), { target: { value: "2027-01-15" } });
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Transmettre ma demande" }));

    expect(await screen.findByText("Avec ce motif, le départ est possible au plus tôt le 20/02/2027.")).toBeTruthy();
    expect(api.calls.some((call) => call.method === "POST")).toBe(false);
  });

  it("exige le motif et la confirmation", async () => {
    const api = stubApi(stubs());

    const { user } = renderApi(<ApiCongeScreen />, { pathname: "/bail/conge" });
    await user.click(await screen.findByRole("button", { name: "Transmettre ma demande" }));

    expect(await screen.findByText("Choisissez le motif de votre préavis.")).toBeTruthy();
    expect(screen.getByText("Cochez la case pour confirmer votre demande.")).toBeTruthy();
    expect(api.calls.some((call) => call.method === "POST")).toBe(false);
  });

  it("refuse une adresse de réexpédition trop longue", async () => {
    const api = stubApi(stubs());

    const { user } = renderApi(<ApiCongeScreen />, { pathname: "/bail/conge" });
    await pick(user, STANDARD);
    fireEvent.change(screen.getByLabelText("Adresse (facultatif)"), { target: { value: "a".repeat(301) } });
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Transmettre ma demande" }));

    expect(await screen.findByText(/L’adresse est trop longue/)).toBeTruthy();
    expect(api.calls.some((call) => call.method === "POST")).toBe(false);
  });

  it("traduit le refus du serveur et rejoue avec le même identifiant", async () => {
    const api = stubApi({ ...stubs(), [SUBMIT]: { status: 409, body: problem(409, "notice_request_exists", "x") } });

    const { user } = renderApi(<ApiCongeScreen />, { pathname: "/bail/conge" });
    await pick(user, STANDARD);
    await user.click(screen.getByRole("checkbox"));
    await confirmSend(user);

    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText(/Vous avez déjà une demande de congé en cours/)).toBeTruthy();
    await user.click(within(dialog).getByRole("button", { name: "Transmettre ma demande" }));
    await waitFor(() => { expect(api.calls.filter((call) => call.method === "POST")).toHaveLength(2); });
    const ids = api.calls.filter((call) => call.method === "POST").map((call) => call.fields.client_id);
    expect(ids[0]).toBe(ids[1]);
  });

  it("n’offre pas le formulaire quand le congé en ligne est indisponible", async () => {
    stubApi(stubs(noticeOptions({ available: false, unavailable_reason: "lease_notice_not_allowed", reasons: [] })));

    renderApi(<ApiCongeScreen />, { pathname: "/bail/conge" });

    expect(await screen.findByText("Congé en ligne indisponible")).toBeTruthy();
    expect(screen.getByText(/Un congé ne peut plus être demandé en ligne pour ce bail/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Transmettre ma demande" })).toBeNull();
  });

  it("signale une panne du serveur sur les options", async () => {
    stubApi({ ...LEASES, [OPTIONS]: { status: 500, body: problem(500, "server_error", "Boom") }, [LIST]: { body: page([]) } });

    renderApi(<ApiCongeScreen />, { pathname: "/bail/conge" });

    expect(await screen.findByText("Le formulaire de congé n’a pas pu être chargé")).toBeTruthy();
  });
});

describe("donner congé : suivi", () => {
  it("affiche une demande transmise avec son statut et son départ indicatif", async () => {
    stubApi(stubs(noticeOptions({ available: false, unavailable_reason: "notice_request_exists" }), [noticeRequest()]));

    renderApi(<ApiCongeScreen />, { pathname: "/bail/conge" });

    expect(await screen.findByText("Transmise, en attente d’accusé de réception")).toBeTruthy();
    expect(screen.getByText("Départ (indicatif)")).toBeTruthy();
    expect(screen.getByText("28/02/2027")).toBeTruthy();
    expect(screen.getByText("Préavis standard")).toBeTruthy();
  });

  it("n’affiche que les demandes du bail choisi", async () => {
    stubApi(stubs(noticeOptions({ available: false }), [noticeRequest(), noticeRequest({ id: "0193a5e6-0000-7000-8000-000000000002", lease_id: LEASE_LOIRE_ID, requested_departure_on: "2028-01-31" })]));

    renderApi(<ApiCongeScreen />, { pathname: "/bail/conge" });
    await screen.findByText("Transmise, en attente d’accusé de réception");

    expect(screen.queryByText("31/01/2028")).toBeNull();
  });

  it("retire une demande transmise après confirmation", async () => {
    const api = stubApi({ ...stubs(noticeOptions({ available: false }), [noticeRequest()]), [WITHDRAW]: { body: { data: noticeRequest({ status: "withdrawn", withdrawn_at: "2026-11-20T11:00:00+00:00" }) } } });

    const { user } = renderApi(<ApiCongeScreen />, { pathname: "/bail/conge" });
    await user.click(await screen.findByRole("button", { name: "Retirer ma demande" }));
    expect(api.calls.some((call) => call.method === "DELETE")).toBe(false);
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Retirer ma demande" }));

    await waitFor(() => { expect(api.count("DELETE", `/api/v1/tenant/notice-requests/${ID.notice}`)).toBe(1); });
    expect(await screen.findByText("Demande retirée")).toBeTruthy();
  });

  it("explique qu’une demande déjà accusée ne se retire plus", async () => {
    stubApi({ ...stubs(noticeOptions({ available: false }), [noticeRequest()]), [WITHDRAW]: { status: 409, body: problem(409, "notice_request_locked", "x") } });

    const { user } = renderApi(<ApiCongeScreen />, { pathname: "/bail/conge" });
    await user.click(await screen.findByRole("button", { name: "Retirer ma demande" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Retirer ma demande" }));

    expect(await screen.findByText(/a déjà été accusée ou clôturée par l’agence/)).toBeTruthy();
  });

  it("n’offre pas le retrait d’une demande accusée et affiche la date de réception", async () => {
    stubApi(stubs(noticeOptions({ available: false }), [noticeRequest({ status: "acknowledged", received_on: "2026-11-21", departure_is_indicative: false, acknowledged_at: "2026-11-21T09:00:00+00:00" })]));

    renderApi(<ApiCongeScreen />, { pathname: "/bail/conge" });

    expect(await screen.findByText("Réception accusée par l’agence")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Retirer ma demande" })).toBeNull();
    expect(screen.getByText("Réception actée")).toBeTruthy();
    expect(screen.getByText("Départ")).toBeTruthy();
  });

  it("explique la clôture d’une demande enregistrée par l’agence", async () => {
    stubApi(stubs(noticeOptions({ available: false }), [noticeRequest({ status: "closed", closed_outcome: "recorded", closed_at: "2026-11-25T09:00:00+00:00" })]));

    renderApi(<ApiCongeScreen />, { pathname: "/bail/conge" });

    expect(await screen.findByText("Votre congé a été enregistré sur le bail par l’agence.")).toBeTruthy();
  });

  it("avertit quand l’agence tarde et télécharge la lettre à envoyer", async () => {
    const saved = captureDownloads();
    const api = stubApi({ ...stubs(noticeOptions({ available: false }), [noticeRequest({ acknowledgement_overdue: true })]), [LETTER]: { pdf: "%PDF-1.4" } });

    const { user } = renderApi(<ApiCongeScreen />, { pathname: "/bail/conge" });
    expect(await screen.findByText("L’agence n’a pas encore accusé réception")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Télécharger la lettre de congé" }));

    await waitFor(() => { expect(saved).toHaveLength(1); });
    expect(api.count("GET", `/api/v1/tenant/notice-requests/${ID.notice}/letter`)).toBe(1);
  });

  it("annonce l’absence de demande", async () => {
    stubApi(stubs(noticeOptions({ available: false })));

    renderApi(<ApiCongeScreen />, { pathname: "/bail/conge" });

    expect(await screen.findByText("Vous n’avez fait aucune demande de congé pour ce bail.")).toBeTruthy();
  });
});
