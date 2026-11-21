import { screen, waitFor } from "@testing-library/react";
import { ExternalInboxPage, ExternalNewThreadPage, ExternalThreadPage } from "@eguardimmo/messagerie";
import {
  ACCESS_ID,
  ATTACHMENT_ID,
  SECOND_MESSAGE_ID,
  SECOND_THREAD_ID,
  THREAD_ID,
  detailResponse,
  listResponse,
  messageFixture,
  messagesResponse,
  ownMessageFixture,
  ownerOptionsResponse,
  problem,
  threadFixture,
  unreadResponse,
} from "@eguardimmo/messagerie/testing";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApi, stubApi } from "../../../test/api";
import { expectNoA11yViolations } from "../../../test/axe";
import { captureDownloads } from "../../../test/download";
import { push, setLocation } from "../../../test/navigation";
import { ConversationsProvider } from "./ConversationsProvider";

vi.mock("next/navigation", async () => (await import("../../../test/navigation")).navigationMock);
vi.mock("next/link", async () => (await import("../../../test/navigation")).linkMock);

const ROOT = "/api/v1/owner/conversations";
const THREAD = `${ROOT}/${THREAD_ID}`;
const DEMO_TEXTS = ["Dupont Gestion", "Les Tilleuls", "Koffi Adjovi", "gestion@example.com"];

beforeEach(() => {
  push.mockClear();
  setLocation("/confie/messages");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function mount(ui: ReactElement) {
  return renderApi(<ConversationsProvider>{ui}</ConversationsProvider>);
}

const threadStub = (messages = [messageFixture()], overrides = {}) => ({
  [`GET ${THREAD}`]: { body: detailResponse(threadFixture({ unread: false, lease: null, mandate: { id: ACCESS_ID, reference: "MND-2026-004" }, ...overrides }), messages) },
  [`GET ${ROOT}/options`]: { body: ownerOptionsResponse },
});

describe("boîte de réception du propriétaire (api)", () => {
  it("liste les conversations de l’espace propriétaire avec des liens vers /confie/messages", async () => {
    const api = stubApi({
      [`GET ${ROOT}`]: { body: listResponse([threadFixture({ lease: null, mandate: { id: ACCESS_ID, reference: "MND-2026-004" } }), threadFixture({ id: SECOND_THREAD_ID, subject: "Reversement de décembre", unread: false })]) },
      [`GET ${ROOT}/unread`]: { body: unreadResponse(1) },
      [`GET ${ROOT}/options`]: { body: ownerOptionsResponse },
    });

    const { container } = mount(<ExternalInboxPage />);

    expect((await screen.findByRole("link", { name: /Quittance de novembre/ })).getAttribute("href")).toBe(`/confie/messages/${THREAD_ID}`);
    expect(screen.getByRole("link", { name: /Reversement de décembre/ }).getAttribute("href")).toBe(`/confie/messages/${SECOND_THREAD_ID}`);
    expect(screen.getByRole("link", { name: /Nouveau message/ }).getAttribute("href")).toBe("/confie/messages/nouveau");
    expect(api.calls.find((call) => call.path === ROOT)?.query).toEqual({ per_page: "25" });
    for (const text of DEMO_TEXTS) expect(document.body.textContent).not.toContain(text);
    await expectNoA11yViolations(container);
  });

  it("filtre par agence avec le paramètre agency quand plusieurs agences existent", async () => {
    const second = { access_id: "0193a5e1-0000-7000-8000-0000000000d2", agency: { id: "0193a5e1-0000-7000-8000-0000000000b2", name: "Cabinet Horizon" }, mandant_name: "SCI Les Palmiers" };
    const api = stubApi({
      [`GET ${ROOT}`]: { body: listResponse([threadFixture()]) },
      [`GET ${ROOT}/unread`]: { body: unreadResponse(0) },
      [`GET ${ROOT}/options`]: { body: { data: [...ownerOptionsResponse.data, second] } },
    });
    const { user } = mount(<ExternalInboxPage />);

    await user.click(await screen.findByRole("combobox", { name: /Agence/ }));
    await user.click(await screen.findByRole("option", { name: "Cabinet Horizon" }));

    await waitFor(() => { expect(api.calls.some((call) => call.path === ROOT && call.query.agency === second.agency.id)).toBe(true); });
  });

  it("annonce l’absence de conversation et traduit une erreur du serveur", async () => {
    const api = stubApi({ [`GET ${ROOT}`]: { body: listResponse([]) }, [`GET ${ROOT}/unread`]: { body: unreadResponse(0) }, [`GET ${ROOT}/options`]: { body: ownerOptionsResponse } });
    const first = mount(<ExternalInboxPage />);

    expect(await screen.findByText("Aucune conversation")).toBeTruthy();
    first.unmount();

    api.on("GET", ROOT, problem(500, "server_error"));
    mount(<ExternalInboxPage />);
    expect(await screen.findByRole("button", { name: "Réessayer" })).toBeTruthy();
  });
});

describe("conversation du propriétaire (api)", () => {
  it("affiche le fil, le mandat et rend les textes comme du texte", async () => {
    const hostile = '<script>window.pwned=1</script> **gras** https://exemple.test/piege';
    stubApi({ ...threadStub([messageFixture({ body: hostile }), ownMessageFixture()]) });

    const { container } = mount(<ExternalThreadPage threadId={THREAD_ID} />);

    const log = await screen.findByRole("log", { name: "Messages de la conversation" });
    expect(log.querySelector("script")).toBeNull();
    expect(log.querySelector("a")).toBeNull();
    expect(log.textContent).toContain("<script>window.pwned=1</script>");
    expect(screen.getByText("Mandat MND-2026-004")).toBeTruthy();
    for (const text of DEMO_TEXTS) expect(document.body.textContent).not.toContain(text);
    await expectNoA11yViolations(container);
  });

  it("n’offre pas la réponse à un accès en lecture seule et l’explique", async () => {
    stubApi({ ...threadStub([messageFixture()], { can_reply: false }) });

    mount(<ExternalThreadPage threadId={THREAD_ID} />);

    expect(await screen.findByText("Lecture seule")).toBeTruthy();
    expect(screen.getByText(/Votre accès est en lecture seule/)).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "Votre réponse" })).toBeNull();
  });

  it("marque lue la conversation à l’ouverture", async () => {
    const api = stubApi({
      ...threadStub(),
      [`GET ${THREAD}`]: { body: detailResponse(threadFixture({ unread: true }), [messageFixture()]) },
      [`PATCH ${THREAD}`]: { body: { data: threadFixture({ unread: false }) } },
    });

    mount(<ExternalThreadPage threadId={THREAD_ID} />);

    await waitFor(() => { expect(api.calls.some((call) => call.method === "PATCH")).toBe(true); });
    expect(api.calls.find((call) => call.method === "PATCH")?.json).toEqual({ read: true });
  });

  it("répond avec un client_id, et le rejoue à l’identique après une indisponibilité", async () => {
    let attempts = 0;
    const api = stubApi({
      ...threadStub(),
      [`POST ${THREAD}/messages`]: () => {
        attempts += 1;
        return attempts === 1 ? problem(503, "service_unavailable") : { status: 201, body: { data: ownMessageFixture() } };
      },
    });
    const { user } = mount(<ExternalThreadPage threadId={THREAD_ID} />);

    await user.type(await screen.findByRole("textbox", { name: "Votre réponse" }), "Bonjour");
    await user.click(screen.getByRole("button", { name: "Envoyer" }));
    expect(await screen.findByText(/enregistré qu’une seule fois/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Envoyer" }));

    expect(await screen.findByRole("article", { name: "Message de Awa Koffi" })).toBeTruthy();
    const posts = api.calls.filter((call) => call.method === "POST").map((call) => call.json as { body: string; client_id: string });
    expect(posts).toHaveLength(2);
    expect(posts[0]?.client_id).toBe(posts[1]?.client_id);
    expect(posts[0]?.body).toBe("Bonjour");
  });

  it("traduit le refus d’un accès devenu lecture seule pendant la saisie", async () => {
    stubApi({ ...threadStub(), [`POST ${THREAD}/messages`]: problem(403, "conversation_read_only") });
    const { user } = mount(<ExternalThreadPage threadId={THREAD_ID} />);

    await user.type(await screen.findByRole("textbox", { name: "Votre réponse" }), "Bonjour");
    await user.click(screen.getByRole("button", { name: "Envoyer" }));

    expect(await screen.findByText("Envoi impossible")).toBeTruthy();
    expect(document.body.textContent).not.toContain("conversation_read_only");
    expect(screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Votre réponse" }).value).toBe("Bonjour");
  });

  it("télécharge une pièce jointe depuis l’espace propriétaire", async () => {
    const downloads = captureDownloads();
    const attachment = { id: ATTACHMENT_ID, name: "releve.pdf", mime_type: "application/pdf", size_bytes: 4096 };
    const api = stubApi({
      ...threadStub([messageFixture({ attachments: [attachment] })]),
      [`GET /api/v1/owner/conversation-attachments/${ATTACHMENT_ID}`]: { file: { type: "application/pdf", content: "%PDF-1.4" } },
    });
    const { user } = mount(<ExternalThreadPage threadId={THREAD_ID} />);

    await user.click(await screen.findByRole("button", { name: /releve\.pdf/ }));

    await waitFor(() => { expect(downloads.names).toEqual(["releve.pdf"]); });
    expect(api.calls.some((call) => call.path.includes("/owner/conversation-attachments/"))).toBe(true);
  });

  it("retire son message après confirmation", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date("2026-11-19T09:10:00+00:00") });
    const api = stubApi({
      ...threadStub([messageFixture(), ownMessageFixture()]),
      [`POST ${THREAD}/messages/${SECOND_MESSAGE_ID}/redaction`]: { body: { data: ownMessageFixture({ redacted: true, body: "[message retiré]" }) } },
    });
    const { user } = mount(<ExternalThreadPage threadId={THREAD_ID} />);

    await user.click(await screen.findByRole("button", { name: "Retirer ce message" }));
    await user.click(await screen.findByRole("button", { name: "Retirer le message" }));

    expect(await screen.findByText("Message retiré")).toBeTruthy();
    expect(api.calls.some((call) => call.path.endsWith("/redaction"))).toBe(true);
    vi.useRealTimers();
  });

  it("archive la conversation puis revient à la boîte du propriétaire", async () => {
    const api = stubApi({ ...threadStub(), [`PATCH ${THREAD}`]: { body: { data: threadFixture({ archived: true }) } } });
    const { user } = mount(<ExternalThreadPage threadId={THREAD_ID} />);

    await user.click(await screen.findByRole("button", { name: "Archiver" }));

    await waitFor(() => { expect(push).toHaveBeenCalledWith("/confie/messages"); });
    expect(api.calls.find((call) => call.method === "PATCH")?.json).toEqual({ archived: true });
  });

  it("interroge les nouveaux messages toutes les 10 secondes", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const incoming = messageFixture({ id: SECOND_MESSAGE_ID, body: "Une réponse de l’agence", sent_at: "2026-11-19T09:11:00+00:00" });
    stubApi({ ...threadStub(), [`GET ${THREAD}/messages`]: { body: messagesResponse([incoming]) } });
    mount(<ExternalThreadPage threadId={THREAD_ID} />);
    await screen.findByRole("log");

    await vi.advanceTimersByTimeAsync(10_500);

    expect(await screen.findByText("Une réponse de l’agence")).toBeTruthy();
    vi.useRealTimers();
  });
});

describe("nouveau message du propriétaire (api)", () => {
  it("écrit à l’agence du mandat avec access_id, puis ouvre le fil", async () => {
    const api = stubApi({
      [`GET ${ROOT}/options`]: { body: ownerOptionsResponse },
      [`POST ${ROOT}`]: { status: 201, body: detailResponse(threadFixture(), [messageFixture({ mine: true, author: { side: "me", name: "Awa Koffi" } })]) },
    });
    const { user, container } = mount(<ExternalNewThreadPage />);

    expect((await screen.findByRole("textbox", { name: "Agence et mandant" })).getAttribute("readonly")).not.toBeNull();
    await expectNoA11yViolations(container);
    await user.type(screen.getByRole("textbox", { name: "Objet" }), "Reversement");
    await user.type(screen.getByRole("textbox", { name: "Message" }), "Bonjour");
    await user.click(screen.getByRole("button", { name: "Envoyer" }));

    await waitFor(() => { expect(push).toHaveBeenCalledWith(`/confie/messages/${THREAD_ID}`); });
    const post = api.calls.find((call) => call.method === "POST");
    expect(Object.keys(post?.json as object).sort()).toEqual(["access_id", "body", "client_id", "subject"]);
    expect(post?.json).toMatchObject({ access_id: ACCESS_ID, subject: "Reversement", body: "Bonjour" });
  });

  it("explique qu’aucun accès ne permet d’écrire", async () => {
    stubApi({ [`GET ${ROOT}/options`]: { body: { data: [] } } });

    mount(<ExternalNewThreadPage />);

    expect(await screen.findByText("Aucun accès ne permet d’écrire pour le moment")).toBeTruthy();
  });

  it("n’appelle pas le serveur avec un message vide", async () => {
    const api = stubApi({ [`GET ${ROOT}/options`]: { body: ownerOptionsResponse } });
    const { user } = mount(<ExternalNewThreadPage />);

    await user.click(await screen.findByRole("button", { name: "Envoyer" }));

    expect((await screen.findAllByText(/Saisissez/)).length).toBeGreaterThan(0);
    expect(api.calls.some((call) => call.method === "POST")).toBe(false);
  });
});
