import { screen, within } from "@testing-library/react";
import { AnnouncementDetailPage, AnnouncementsListPage } from "@eguardimmo/messagerie";
import {
  ANNOUNCEMENT_ATTACHMENT_ID,
  ANNOUNCEMENT_ID,
  SECOND_ANNOUNCEMENT_ID,
  announcementFixture,
  announcementListResponse,
  announcementResponse,
  readAnnouncementFixture,
} from "@eguardimmo/messagerie/announcements-testing";
import { problem } from "@eguardimmo/messagerie/testing";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApi, stubApi } from "../../../test/api";
import { expectNoA11yViolations } from "../../../test/axe";
import { setLocation } from "../../../test/navigation";
import { OwnerAnnouncementsProvider } from "./AnnouncementsProvider";

vi.mock("next/navigation", async () => (await import("../../../test/navigation")).navigationMock);
vi.mock("next/link", async () => (await import("../../../test/navigation")).linkMock);

const ROOT = "/api/v1/owner/announcements";
const ONE = `${ROOT}/${ANNOUNCEMENT_ID}`;
const DEMO_TEXTS = ["Dupont Gestion", "Les Tilleuls", "Koffi Adjovi", "gestion@example.com"];

beforeEach(() => {
  setLocation("/confie/annonces");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function mount(ui: ReactElement) {
  return renderApi(<OwnerAnnouncementsProvider>{ui}</OwnerAnnouncementsProvider>);
}

describe("annonces du propriétaire (api)", () => {
  it("liste les annonces de l’espace propriétaire avec des liens vers /confie/annonces", async () => {
    const api = stubApi({
      [`GET ${ROOT}`]: { body: announcementListResponse([announcementFixture(), readAnnouncementFixture({ id: SECOND_ANNOUNCEMENT_ID, subject: "Assemblée générale" })]) },
    });

    const { container } = mount(<AnnouncementsListPage />);

    const list = await screen.findByRole("list", { name: "Annonces" });
    expect(within(list).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([`/confie/annonces/${ANNOUNCEMENT_ID}`, `/confie/annonces/${SECOND_ANNOUNCEMENT_ID}`]);
    expect(api.calls.find((call) => call.path === ROOT)?.query).toEqual({ per_page: "25" });
    for (const text of DEMO_TEXTS) expect(document.body.textContent).not.toContain(text);
    await expectNoA11yViolations(container);
  });

  it("annonce l’absence d’annonce", async () => {
    stubApi({ [`GET ${ROOT}`]: { body: announcementListResponse([]) } });
    mount(<AnnouncementsListPage />);
    expect(await screen.findByText("Aucune annonce pour le moment")).toBeTruthy();
  });

  it("lit une annonce, la marque lue sous la session web et revient à la liste par le fil d’Ariane", async () => {
    const attachments = [{ id: ANNOUNCEMENT_ATTACHMENT_ID, name: "avis.pdf", size_bytes: 2048 }];
    const api = stubApi({
      [`GET ${ONE}`]: { body: announcementResponse(announcementFixture({ attachments })) },
      [`POST ${ONE}/read`]: { body: announcementResponse(readAnnouncementFixture({ attachments })) },
    });

    mount(<AnnouncementDetailPage announcementId={ANNOUNCEMENT_ID} />);

    expect(await screen.findByText("Lue")).toBeTruthy();
    expect(api.count("POST", `${ONE}/read`)).toBe(1);
    expect(screen.getByRole("link", { name: "Annonces" }).getAttribute("href")).toBe("/confie/annonces");
    expect(screen.getByRole("link", { name: "Messages" }).getAttribute("href")).toBe("/confie/messages");
    expect(screen.getByRole("button", { name: "Télécharger avis.pdf" })).toBeTruthy();
  });

  it("propose de réessayer quand le serveur refuse l’enregistrement de la lecture", async () => {
    const api = stubApi({
      [`GET ${ONE}`]: { body: announcementResponse(announcementFixture()) },
      [`POST ${ONE}/read`]: problem(403, "http_403", "Session web requise"),
    });

    mount(<AnnouncementDetailPage announcementId={ANNOUNCEMENT_ID} />);

    expect(await screen.findByText("Lecture non enregistrée")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Marquer comme lue" })).toBeTruthy();
    expect(api.count("POST", `${ONE}/read`)).toBe(1);
  });

  it("traduit un refus 404 du serveur", async () => {
    stubApi({ [`GET ${ONE}`]: problem(404, "announcement_not_found", "Annonce introuvable") });
    mount(<AnnouncementDetailPage announcementId={ANNOUNCEMENT_ID} />);
    expect(await screen.findByText("Cette annonce n’existe pas ou ne vous concerne pas.")).toBeTruthy();
  });
});
