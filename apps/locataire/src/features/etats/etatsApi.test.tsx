import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ID, inspection, page, problem, remark } from "@/tenant/complementsResponses.fixtures";
import { LEASE_LOIRE_ID, leasePage, summary } from "@/tenant/responses.fixtures";
import { expectNoA11yViolations } from "../../../test/axe";
import { renderApi, stubApi } from "../../../test/api";
import { captureDownloads, nth } from "../rent/testKit";
import { ApiEtatDetailScreen } from "./ApiEtatDetailScreen";
import { ApiEtatsScreen } from "./ApiEtatsScreen";

const LEASES = { "GET /api/v1/tenant/leases": { body: leasePage([summary()]) } };
const LIST = "GET /api/v1/tenant/inspections";
const ONE = `GET /api/v1/tenant/inspections/${ID.inspectionEntry}`;
const REMARKS = `GET /api/v1/tenant/inspections/${ID.inspectionEntry}/remarks`;
const CREATE = `POST /api/v1/tenant/inspections/${ID.inspectionEntry}/remarks`;
const DOCUMENT = `GET /api/v1/tenant/inspections/${ID.inspectionEntry}/document`;
const PHOTO = `GET /api/v1/tenant/inspection-files/${ID.photo}`;
const DEMO_TEXTS = ["Koffi Adjovi", "Les Tilleuls", "Apt A1"];

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const detailStubs = (item = inspection(), remarks: unknown[] = []) => ({ ...LEASES, [ONE]: { body: { data: item } }, [REMARKS]: { body: page(remarks) } });
const jpeg = (name = "radiateur.jpg") => new File(["x"], name, { type: "image/jpeg" });

async function pickKind(user: ReturnType<typeof renderApi>["user"], option: string) {
  await user.click(await screen.findByRole("combobox", { name: /Nature de la remarque/ }));
  await user.click(await screen.findByRole("option", { name: option }));
}

describe("états des lieux : liste", () => {
  it("liste les états publiés avec détail et téléchargement", async () => {
    const saved = captureDownloads();
    const api = stubApi({ ...LEASES, [LIST]: { body: page([inspection(), inspection({ id: ID.inspectionExit, kind: "exit", performed_on: "2027-03-01", open_remark_kinds: [] })]) }, [DOCUMENT]: { pdf: "%PDF-1.4" } });

    const { user, container } = renderApi(<ApiEtatsScreen />, { pathname: "/etats-des-lieux" });

    const table = await screen.findByRole("table", { name: "États des lieux" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(nth(rows, 0).textContent).toContain("État des lieux d’entrée");
    expect(nth(rows, 0).textContent).toContain("02/01/2026");
    expect(nth(rows, 0).textContent).toContain("Publié, figé");
    expect(nth(rows, 1).textContent).toContain("Délai écoulé");
    expect(within(nth(rows, 0)).getByRole("link", { name: "Voir le détail" }).getAttribute("href")).toBe(`/etats-des-lieux/${ID.inspectionEntry}`);
    for (const text of DEMO_TEXTS) expect(document.body.textContent).not.toContain(text);
    await expectNoA11yViolations(container);

    await user.click(within(nth(rows, 0)).getByRole("button", { name: /Télécharger État des lieux d’entrée du 02\/01\/2026/ }));
    await waitFor(() => { expect(saved).toHaveLength(1); });
    expect(api.count("GET", `/api/v1/tenant/inspections/${ID.inspectionEntry}/document`)).toBe(1);
  });

  it("n’offre ni détail ni téléchargement pour un état non publié", async () => {
    stubApi({ ...LEASES, [LIST]: { body: page([inspection({ published_at: null, open_remark_kinds: [] })]) } });

    renderApi(<ApiEtatsScreen />, { pathname: "/etats-des-lieux" });

    expect(await screen.findByText("Non publié")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Voir le détail" })).toBeNull();
  });

  it("n’affiche que les états du bail choisi et annonce l’absence d’état", async () => {
    stubApi({ ...LEASES, [LIST]: { body: page([inspection({ lease_id: LEASE_LOIRE_ID })]) } });

    renderApi(<ApiEtatsScreen />, { pathname: "/etats-des-lieux" });

    expect(await screen.findByText("Aucun état des lieux n’a encore été publié pour ce bail.")).toBeTruthy();
  });

  it("signale une panne du serveur", async () => {
    stubApi({ ...LEASES, [LIST]: { status: 500, body: problem(500, "server_error", "Boom") } });

    renderApi(<ApiEtatsScreen />, { pathname: "/etats-des-lieux" });

    expect(await screen.findByText("Les états des lieux n’ont pas pu être chargés")).toBeTruthy();
  });
});

describe("états des lieux : détail et remarques", () => {
  it("affiche l’état figé, ses signataires et les remarques déjà faites", async () => {
    stubApi(detailStubs(inspection(), [remark({ status: "answered", answer: { decision: "accepted", body: "Radiateur remplacé.", answered_at: "2026-11-19T09:00:00+00:00" } })]));

    const { container } = renderApi(<ApiEtatDetailScreen id={ID.inspectionEntry} />, { pathname: `/etats-des-lieux/${ID.inspectionEntry}` });

    expect(await screen.findByRole("heading", { level: 1, name: "État des lieux d’entrée" })).toBeTruthy();
    expect(screen.getByText("Publié, figé")).toBeTruthy();
    expect(screen.getByText("Document figé")).toBeTruthy();
    expect(screen.getByText("Awa Koné")).toBeTruthy();
    expect(await screen.findByText("Le radiateur du salon ne chauffe pas.")).toBeTruthy();
    expect(screen.getByText("Acceptée par l’agence")).toBeTruthy();
    expect(screen.getByText("Radiateur remplacé.")).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it("n’offre que les natures de remarque encore ouvertes", async () => {
    stubApi(detailStubs());

    const { user } = renderApi(<ApiEtatDetailScreen id={ID.inspectionEntry} />, { pathname: `/etats-des-lieux/${ID.inspectionEntry}` });
    await user.click(await screen.findByRole("combobox", { name: /Nature de la remarque/ }));

    expect(await screen.findByRole("option", { name: "Remarque sur le chauffage" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Commentaire sur l’état de sortie" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Complément à l’état d’entrée" })).toBeNull();
  });

  it("envoie une remarque avec ses photos puis la recharge", async () => {
    const api = stubApi({ ...detailStubs(), [CREATE]: { status: 201, body: { data: remark() } } });

    const { user } = renderApi(<ApiEtatDetailScreen id={ID.inspectionEntry} />, { pathname: `/etats-des-lieux/${ID.inspectionEntry}` });
    await pickKind(user, "Remarque sur le chauffage");
    await user.type(screen.getByLabelText("Votre remarque *"), "Le radiateur du salon ne chauffe pas.");
    await user.upload(screen.getByLabelText(/Joindre des photos/), [jpeg("a.jpg"), jpeg("b.jpg")]);
    await user.click(screen.getByRole("button", { name: "Envoyer la remarque" }));

    await waitFor(() => { expect(api.count("POST", `/api/v1/tenant/inspections/${ID.inspectionEntry}/remarks`)).toBe(1); });
    const call = api.calls.find((item) => item.method === "POST");
    expect(call?.fields).toMatchObject({ kind: "heating", body: "Le radiateur du salon ne chauffe pas." });
    expect(call?.fields.client_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(call?.files["photos[]"]).toEqual(["a.jpg", "b.jpg"]);
    expect(await screen.findByText("Remarque envoyée")).toBeTruthy();
    await waitFor(() => { expect(api.count("GET", `/api/v1/tenant/inspections/${ID.inspectionEntry}/remarks`)).toBe(2); });
  });

  it("exige la nature et un texte avant tout appel", async () => {
    const api = stubApi(detailStubs());

    const { user } = renderApi(<ApiEtatDetailScreen id={ID.inspectionEntry} />, { pathname: `/etats-des-lieux/${ID.inspectionEntry}` });
    await user.click(await screen.findByRole("button", { name: "Envoyer la remarque" }));

    expect(await screen.findByText("Choisissez la nature de votre remarque.")).toBeTruthy();
    expect(screen.getByText(/Décrivez votre remarque/)).toBeTruthy();
    expect(api.calls.some((call) => call.method === "POST")).toBe(false);
  });

  it("refuse plus de six photos", async () => {
    const api = stubApi(detailStubs());

    const { user } = renderApi(<ApiEtatDetailScreen id={ID.inspectionEntry} />, { pathname: `/etats-des-lieux/${ID.inspectionEntry}` });
    await pickKind(user, "Remarque sur le chauffage");
    await user.type(screen.getByLabelText("Votre remarque *"), "Le radiateur est froid.");
    await user.upload(screen.getByLabelText(/Joindre des photos/), Array.from({ length: 7 }, (_, index) => jpeg(`p${String(index)}.jpg`)));
    await user.click(screen.getByRole("button", { name: "Envoyer la remarque" }));

    expect(await screen.findByText("Six photos au maximum par remarque.")).toBeTruthy();
    expect(api.calls.some((call) => call.method === "POST")).toBe(false);
  });

  it("refuse une photo d’un format non accepté", async () => {
    const api = stubApi(detailStubs());

    const { user } = renderApi(<ApiEtatDetailScreen id={ID.inspectionEntry} />, { pathname: `/etats-des-lieux/${ID.inspectionEntry}` });
    await pickKind(user, "Remarque sur le chauffage");
    await user.type(screen.getByLabelText("Votre remarque *"), "Le radiateur est froid.");
    fireEvent.change(screen.getByLabelText(/Joindre des photos/), { target: { files: [new File(["x"], "doc.pdf", { type: "application/pdf" })] } });
    await user.click(screen.getByRole("button", { name: "Envoyer la remarque" }));

    expect(await screen.findByText(/n'est pas d'un format accepté/)).toBeTruthy();
    expect(api.calls.some((call) => call.method === "POST")).toBe(false);
  });

  it.each([
    ["inspection_remark_window_closed", "Ce type de remarque n’est plus possible : le délai est dépassé pour cet état des lieux."],
    ["inspection_published", "Un état des lieux publié est figé : il ne se modifie plus. Ajoutez plutôt une remarque."],
    ["inspection_stale_version", "Cet état des lieux a changé entre-temps : rechargez la page."],
    ["inspection_remark_answered", "Cette remarque a déjà reçu une réponse de l’agence : elle ne peut plus évoluer."],
    ["inspection_remark_not_found", "Cette remarque n’existe plus."],
  ])("traduit l’erreur %s du serveur", async (code, message) => {
    stubApi({ ...detailStubs(), [CREATE]: { status: 409, body: problem(409, code, "x") } });

    const { user } = renderApi(<ApiEtatDetailScreen id={ID.inspectionEntry} />, { pathname: `/etats-des-lieux/${ID.inspectionEntry}` });
    await pickKind(user, "Remarque sur le chauffage");
    await user.type(screen.getByLabelText("Votre remarque *"), "Le radiateur est froid.");
    await user.click(screen.getByRole("button", { name: "Envoyer la remarque" }));

    expect(await screen.findByText(message)).toBeTruthy();
  });

  it("télécharge le document et une photo de remarque", async () => {
    const saved = captureDownloads();
    const api = stubApi({ ...detailStubs(inspection(), [remark()]), [DOCUMENT]: { pdf: "%PDF-1.4" }, [PHOTO]: { pdf: "x", headers: { "Content-Type": "image/jpeg" } } });

    const { user } = renderApi(<ApiEtatDetailScreen id={ID.inspectionEntry} />, { pathname: `/etats-des-lieux/${ID.inspectionEntry}` });
    await user.click(await screen.findByRole("button", { name: "Télécharger le document" }));
    await waitFor(() => { expect(saved).toHaveLength(1); });
    await user.click(await screen.findByRole("button", { name: "Télécharger la photo 1 de la remarque" }));

    await waitFor(() => { expect(saved).toHaveLength(2); });
    expect(api.count("GET", `/api/v1/tenant/inspections/${ID.inspectionEntry}/document`)).toBe(1);
    expect(api.count("GET", `/api/v1/tenant/inspection-files/${ID.photo}`)).toBe(1);
  });

  it("n’offre pas de remarque quand les délais sont écoulés", async () => {
    stubApi(detailStubs(inspection({ open_remark_kinds: [] })));

    renderApi(<ApiEtatDetailScreen id={ID.inspectionEntry} />, { pathname: `/etats-des-lieux/${ID.inspectionEntry}` });

    expect(await screen.findByText(/les délais sont écoulés/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Envoyer la remarque" })).toBeNull();
  });

  it("n’offre ni remarque ni téléchargement pour un état non publié", async () => {
    stubApi(detailStubs(inspection({ published_at: null })));

    renderApi(<ApiEtatDetailScreen id={ID.inspectionEntry} />, { pathname: `/etats-des-lieux/${ID.inspectionEntry}` });

    expect(await screen.findByText("Pas encore consultable")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Télécharger le document" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Envoyer la remarque" })).toBeNull();
  });

  it("indique la conformité d’un état de sortie à l’entrée", async () => {
    stubApi({ ...LEASES, [ONE]: { body: { data: inspection({ kind: "exit", exit_matches_entry: true, open_remark_kinds: [] }) } }, [REMARKS]: { body: page([]) } });

    renderApi(<ApiEtatDetailScreen id={ID.inspectionEntry} />, { pathname: `/etats-des-lieux/${ID.inspectionEntry}` });

    expect(await screen.findByRole("heading", { level: 1, name: "État des lieux de sortie" })).toBeTruthy();
    expect(screen.getByText("Conforme à l’entrée")).toBeTruthy();
    expect(screen.getByText("Oui")).toBeTruthy();
  });

  it("affiche l’état introuvable sur une réponse 404", async () => {
    stubApi({ ...LEASES, [ONE]: { status: 404, body: problem(404, "inspection_not_found", "x") }, [REMARKS]: { body: page([]) } });

    renderApi(<ApiEtatDetailScreen id={ID.inspectionEntry} />, { pathname: `/etats-des-lieux/${ID.inspectionEntry}` });

    expect(await screen.findByText("État des lieux introuvable")).toBeTruthy();
  });
});
