import { screen, waitFor, within } from "@testing-library/react";
import { ExternalInboxPage, ExternalNewThreadPage, ExternalThreadPage } from "@eguardimmo/messagerie";
import {
  ATTACHMENT_ID,
  LEASE_ID,
  SECOND_MESSAGE_ID,
  SECOND_THREAD_ID,
  THREAD_ID,
  detailResponse,
  listResponse,
  messageFixture,
  messagesResponse,
  ownMessageFixture,
  problem,
  tenantOptionsResponse,
  threadFixture,
  unreadResponse,
} from "@eguardimmo/messagerie/testing";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../../../test/axe";
import { nav } from "../../../test/navigation";
import { renderApi, stubApi } from "../../../test/api";
import { DEMO_TEXTS, captureDownloads } from "../rent/testKit";
import { ConversationsProvider } from "./ConversationsProvider";

const ROOT = "/api/v1/tenant/conversations";
const THREAD = `${ROOT}/${THREAD_ID}`;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function mount(ui: ReactElement, pathname = "/messages") {
  return renderApi(<ConversationsProvider>{ui}</ConversationsProvider>, { pathname });
}

const threadStub = (messages = [messageFixture()], overrides = {}) => ({
  [`GET ${THREAD}`]: { body: detailResponse(threadFixture({ unread: false, ...overrides }), messages) },
  [`GET ${ROOT}/options`]: { body: tenantOptionsResponse },
});

describe("boîte de réception du locataire (api)", () => {
  it("liste les conversations servies par l’espace locataire, sans organisation ni donnée de démonstration", async () => {
    const api = stubApi({
      [`GET ${ROOT}`]: { body: listResponse([threadFixture(), threadFixture({ id: SECOND_THREAD_ID, subject: "Régularisation de charges", unread: false })]) },
      [`GET ${ROOT}/unread`]: { body: unreadResponse(1) },
      [`GET ${ROOT}/options`]: { body: tenantOptionsResponse },
    });

    const { container } = mount(<ExternalInboxPage />);

    const link = await screen.findByRole("link", { name: /Quittance de novembre/ });
    expect(link.getAttribute("href")).toBe(`/messages/${THREAD_ID}`);
    expect(screen.getByRole("link", { name: /Régularisation de charges/ }).getAttribute("href")).toBe(`/messages/${SECOND_THREAD_ID}`);
    expect(screen.getByRole("link", { name: /Nouveau message/ }).getAttribute("href")).toBe("/messages/nouveau");
    const listCall = api.calls.find((call) => call.path === ROOT);
    expect(listCall?.query).toEqual({ per_page: "25" });
    expect(api.calls.every((call) => !("organization" in call.query))).toBe(true);
    for (const text of DEMO_TEXTS) expect(document.body.textContent).not.toContain(text);
    await expectNoA11yViolations(container);
  });

  it("annonce l’absence de conversation", async () => {
    stubApi({ [`GET ${ROOT}`]: { body: listResponse([]) }, [`GET ${ROOT}/unread`]: { body: unreadResponse(0) }, [`GET ${ROOT}/options`]: { body: tenantOptionsResponse } });

    mount(<ExternalInboxPage />);

    expect(await screen.findByText("Aucune conversation")).toBeTruthy();
  });

  it("traduit un refus du serveur et propose de réessayer, sans afficher le message brut", async () => {
    const api = stubApi({
      [`GET ${ROOT}`]: problem(503, "service_unavailable", "SQLSTATE[08006] connection refused"),
      [`GET ${ROOT}/unread`]: { body: unreadResponse(0) },
      [`GET ${ROOT}/options`]: { body: tenantOptionsResponse },
    });

    const { user } = mount(<ExternalInboxPage />);

    expect(await screen.findByRole("button", { name: "Réessayer" })).toBeTruthy();
    expect(document.body.textContent).not.toContain("SQLSTATE");
    api.on("GET", ROOT, { body: listResponse([threadFixture()]) });
    await user.click(screen.getByRole("button", { name: "Réessayer" }));
    expect(await screen.findByRole("link", { name: /Quittance de novembre/ })).toBeTruthy();
  });

  it("refuse une réponse du serveur qui n’a pas la forme attendue", async () => {
    stubApi({ [`GET ${ROOT}`]: { body: { data: [{ id: 12 }], meta: {} } }, [`GET ${ROOT}/unread`]: { body: unreadResponse(0) }, [`GET ${ROOT}/options`]: { body: tenantOptionsResponse } });

    mount(<ExternalInboxPage />);

    expect(await screen.findByRole("button", { name: "Réessayer" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Quittance/ })).toBeNull();
  });
});

describe("conversation du locataire (api)", () => {
  it("affiche le fil avec le nom du membre de l’équipe et rend les textes comme du texte", async () => {
    const hostile = '<img src=x onerror="window.pwned=1"> https://exemple.test/piege';
    stubApi({ ...threadStub([messageFixture({ body: hostile }), ownMessageFixture()]) });

    const { container } = mount(<ExternalThreadPage threadId={THREAD_ID} />, `/messages/${THREAD_ID}`);

    const log = await screen.findByRole("log", { name: "Messages de la conversation" });
    expect(within(log).getByRole("article", { name: "Message de Camille Martin" })).toBeTruthy();
    expect(log.querySelector("img")).toBeNull();
    expect(log.querySelector("a")).toBeNull();
    expect(log.textContent).toContain(hostile);
    for (const text of DEMO_TEXTS) expect(document.body.textContent).not.toContain(text);
    await expectNoA11yViolations(container);
  });

  it("marque la conversation lue sur le serveur à l’ouverture", async () => {
    const api = stubApi({ ...threadStub(), [`GET ${THREAD}`]: { body: detailResponse(threadFixture({ unread: true }), [messageFixture()]) }, [`PATCH ${THREAD}`]: { body: { data: threadFixture({ unread: false }) } } });

    mount(<ExternalThreadPage threadId={THREAD_ID} />, `/messages/${THREAD_ID}`);

    await waitFor(() => { expect(api.calls.filter((call) => call.method === "PATCH")).toHaveLength(1); });
    expect(api.calls.find((call) => call.method === "PATCH")?.json).toEqual({ read: true });
  });

  it("envoie une réponse avec un client_id et l’ajoute au fil", async () => {
    const api = stubApi({
      ...threadStub(),
      [`POST ${THREAD}/messages`]: { status: 201, body: { data: ownMessageFixture({ body: "Merci !" }) } },
    });
    const { user } = mount(<ExternalThreadPage threadId={THREAD_ID} />, `/messages/${THREAD_ID}`);

    await user.type(await screen.findByRole("textbox", { name: "Votre réponse" }), "Merci !");
    await user.click(screen.getByRole("button", { name: "Envoyer" }));

    expect(await screen.findByRole("article", { name: "Message de Awa Koffi" })).toBeTruthy();
    const post = api.calls.find((call) => call.method === "POST");
    expect(post?.json).toMatchObject({ body: "Merci !" });
    expect((post?.json as { client_id: string }).client_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-/);
  });

  it("rejoue le même client_id après une indisponibilité du serveur", async () => {
    let attempts = 0;
    const api = stubApi({
      ...threadStub(),
      [`POST ${THREAD}/messages`]: () => {
        attempts += 1;
        return attempts === 1 ? problem(503, "service_unavailable") : { status: 201, body: { data: ownMessageFixture() } };
      },
    });
    const { user } = mount(<ExternalThreadPage threadId={THREAD_ID} />, `/messages/${THREAD_ID}`);

    await user.type(await screen.findByRole("textbox", { name: "Votre réponse" }), "Bonjour");
    await user.click(screen.getByRole("button", { name: "Envoyer" }));
    expect(await screen.findByText(/enregistré qu’une seule fois/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Envoyer" }));

    await waitFor(() => { expect(attempts).toBe(2); });
    const ids = api.calls.filter((call) => call.method === "POST").map((call) => (call.json as { client_id: string }).client_id);
    expect(ids[0]).toBe(ids[1]);
  });

  it("joint un fichier en multipart avec le même client_id que le texte", async () => {
    const api = stubApi({ ...threadStub(), [`POST ${THREAD}/messages`]: { status: 201, body: { data: ownMessageFixture() } } });
    const { user, container } = mount(<ExternalThreadPage threadId={THREAD_ID} />, `/messages/${THREAD_ID}`);

    await screen.findByRole("textbox", { name: "Votre réponse" });
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error("Champ fichier introuvable");
    await user.upload(input, new File(["%PDF"], "justificatif.pdf", { type: "application/pdf" }));
    await user.type(screen.getByRole("textbox", { name: "Votre réponse" }), "Voici");
    await user.click(screen.getByRole("button", { name: "Envoyer" }));

    await waitFor(() => { expect(api.calls.some((call) => call.method === "POST")).toBe(true); });
    const post = api.calls.find((call) => call.method === "POST");
    expect(post?.fields.body).toBe("Voici");
    expect(post?.fields.client_id).toMatch(/^[0-9a-f]{8}-/);
  });

  it("n’affiche pas le compositeur quand le serveur refuse les réponses", async () => {
    stubApi({ ...threadStub([messageFixture()], { status: "closed", can_reply: false }) });

    mount(<ExternalThreadPage threadId={THREAD_ID} />, `/messages/${THREAD_ID}`);

    expect(await screen.findByText("Conversation fermée")).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "Votre réponse" })).toBeNull();
  });

  it("télécharge une pièce jointe depuis l’espace locataire, avec les identifiants", async () => {
    const saved = captureDownloads();
    const attachment = { id: ATTACHMENT_ID, name: "quittance.pdf", mime_type: "application/pdf", size_bytes: 2048 };
    const api = stubApi({
      ...threadStub([messageFixture({ attachments: [attachment] })]),
      [`GET /api/v1/tenant/conversation-attachments/${ATTACHMENT_ID}`]: { pdf: "%PDF-1.4" },
    });
    const { user } = mount(<ExternalThreadPage threadId={THREAD_ID} />, `/messages/${THREAD_ID}`);

    await user.click(await screen.findByRole("button", { name: /quittance\.pdf/ }));

    await waitFor(() => { expect(saved).toHaveLength(1); });
    expect(saved[0]?.download).toBe("quittance.pdf");
    expect(api.calls.some((call) => call.path.includes("conversation-attachments"))).toBe(true);
  });

  it("retire son message après confirmation", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date("2026-11-19T09:10:00+00:00") });
    const api = stubApi({
      ...threadStub([messageFixture(), ownMessageFixture()]),
      [`POST ${THREAD}/messages/${SECOND_MESSAGE_ID}/redaction`]: { body: { data: ownMessageFixture({ redacted: true, body: "[message retiré]" }) } },
    });
    const { user } = mount(<ExternalThreadPage threadId={THREAD_ID} />, `/messages/${THREAD_ID}`);

    await user.click(await screen.findByRole("button", { name: "Retirer ce message" }));
    await user.click(await screen.findByRole("button", { name: "Retirer le message" }));

    expect(await screen.findByText("Message retiré")).toBeTruthy();
    expect(api.calls.some((call) => call.path.endsWith("/redaction"))).toBe(true);
    vi.useRealTimers();
  });

  it("archive la conversation puis revient à la boîte", async () => {
    const api = stubApi({ ...threadStub(), [`PATCH ${THREAD}`]: { body: { data: threadFixture({ archived: true }) } } });
    const { user } = mount(<ExternalThreadPage threadId={THREAD_ID} />, `/messages/${THREAD_ID}`);

    await user.click(await screen.findByRole("button", { name: "Archiver" }));

    await waitFor(() => { expect(nav.push).toHaveBeenCalledWith("/messages"); });
    expect(api.calls.find((call) => call.method === "PATCH")?.json).toEqual({ archived: true });
  });

  it("interroge les nouveaux messages toutes les 10 secondes", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const incoming = messageFixture({ id: SECOND_MESSAGE_ID, body: "Une relance de l’agence", sent_at: "2026-11-19T09:11:00+00:00" });
    const api = stubApi({ ...threadStub(), [`GET ${THREAD}/messages`]: { body: messagesResponse([incoming]) } });
    mount(<ExternalThreadPage threadId={THREAD_ID} />, `/messages/${THREAD_ID}`);
    await screen.findByRole("log");

    await vi.advanceTimersByTimeAsync(10_500);

    expect(await screen.findByText("Une relance de l’agence")).toBeTruthy();
    expect(api.calls.find((call) => call.path === `${THREAD}/messages`)?.query).toEqual({ after: messageFixture().id });
    vi.useRealTimers();
  });

  it("traduit une conversation introuvable", async () => {
    stubApi({ [`GET ${THREAD}`]: problem(404, "conversation_not_found") });

    mount(<ExternalThreadPage threadId={THREAD_ID} />, `/messages/${THREAD_ID}`);

    expect(await screen.findByText("Cette conversation n’existe pas ou n’est plus accessible depuis votre espace.")).toBeTruthy();
  });
});

describe("nouveau message du locataire (api)", () => {
  it("ouvre une conversation sur le bail servi, puis affiche le fil", async () => {
    const api = stubApi({
      [`GET ${ROOT}/options`]: { body: tenantOptionsResponse },
      [`POST ${ROOT}`]: { status: 201, body: detailResponse(threadFixture(), [messageFixture({ mine: true, author: { side: "me", name: "Awa Koffi" } })]) },
    });
    const { user, container } = mount(<ExternalNewThreadPage />, "/messages/nouveau");

    expect((await screen.findByRole("textbox", { name: "Bail concerné" })).getAttribute("readonly")).not.toBeNull();
    await expectNoA11yViolations(container);
    await user.type(screen.getByRole("textbox", { name: "Objet" }), "Quittance de novembre");
    await user.type(screen.getByRole("textbox", { name: "Message" }), "Bonjour");
    await user.click(screen.getByRole("button", { name: "Envoyer" }));

    await waitFor(() => { expect(nav.push).toHaveBeenCalledWith(`/messages/${THREAD_ID}`); });
    const post = api.calls.find((call) => call.method === "POST");
    expect(post?.json).toMatchObject({ lease_id: LEASE_ID, subject: "Quittance de novembre", body: "Bonjour" });
    expect(Object.keys(post?.json as object).sort()).toEqual(["body", "client_id", "lease_id", "subject"]);
  });

  it("n’appelle pas le serveur avec un message vide", async () => {
    const api = stubApi({ [`GET ${ROOT}/options`]: { body: tenantOptionsResponse } });
    const { user } = mount(<ExternalNewThreadPage />, "/messages/nouveau");

    await user.click(await screen.findByRole("button", { name: "Envoyer" }));

    expect((await screen.findAllByText(/Saisissez/)).length).toBeGreaterThan(0);
    expect(api.calls.some((call) => call.method === "POST")).toBe(false);
  });

  it("explique qu’aucun bail ne permet d’écrire", async () => {
    stubApi({ [`GET ${ROOT}/options`]: { body: { data: [] } } });

    mount(<ExternalNewThreadPage />, "/messages/nouveau");

    expect(await screen.findByText("Aucun bail ne permet d’écrire pour le moment")).toBeTruthy();
  });
});
