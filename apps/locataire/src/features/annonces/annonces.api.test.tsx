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
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderApi, stubApi } from "../../../test/api";
import { DEMO_TEXTS } from "../rent/testKit";
import { TenantAnnouncementsProvider } from "./AnnouncementsProvider";

const ROOT = "/api/v1/tenant/announcements";
const ONE = `${ROOT}/${ANNOUNCEMENT_ID}`;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function mount(ui: ReactElement, pathname = "/annonces") {
  return renderApi(<TenantAnnouncementsProvider>{ui}</TenantAnnouncementsProvider>, { pathname });
}

describe("annonces du locataire (api)", () => {
  it("liste les annonces de l'espace locataire, sans organisation ni donnée de démonstration", async () => {
    const api = stubApi({
      [`GET ${ROOT}`]: { body: announcementListResponse([announcementFixture(), readAnnouncementFixture({ id: SECOND_ANNOUNCEMENT_ID, subject: "Assemblée générale" })]) },
    });

    mount(<AnnouncementsListPage />);

    const list = await screen.findByRole("list", { name: "Annonces" });
    const links = within(list).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([`/annonces/${ANNOUNCEMENT_ID}`, `/annonces/${SECOND_ANNOUNCEMENT_ID}`]);
    expect(links[0]?.textContent).toContain("non lue");
    expect(api.calls.find((call) => call.path === ROOT)?.query).toEqual({ per_page: "25" });
    for (const text of DEMO_TEXTS) expect(document.body.textContent).not.toContain(text);
  });

  it("annonce l'absence d'annonce", async () => {
    stubApi({ [`GET ${ROOT}`]: { body: announcementListResponse([]) } });
    mount(<AnnouncementsListPage />);
    expect(await screen.findByText("Aucune annonce pour le moment")).toBeTruthy();
  });

  it("traduit une panne serveur sans afficher le message brut", async () => {
    stubApi({ [`GET ${ROOT}`]: problem(503, "service_unavailable", "SQLSTATE[08006] connection refused") });
    mount(<AnnouncementsListPage />);
    expect(await screen.findByRole("button", { name: "Réessayer" })).toBeTruthy();
    expect(document.body.textContent).not.toContain("SQLSTATE");
  });

  it("lit une annonce et la marque lue par un POST sur /read", async () => {
    const attachments = [{ id: ANNOUNCEMENT_ATTACHMENT_ID, name: "avis.pdf", size_bytes: 2048 }];
    const api = stubApi({
      [`GET ${ONE}`]: { body: announcementResponse(announcementFixture({ attachments })) },
      [`POST ${ONE}/read`]: { body: announcementResponse(readAnnouncementFixture({ attachments })) },
    });

    mount(<AnnouncementDetailPage announcementId={ANNOUNCEMENT_ID} />, `/annonces/${ANNOUNCEMENT_ID}`);

    expect(await screen.findByText("Lue")).toBeTruthy();
    expect(api.count("POST", `${ONE}/read`)).toBe(1);
    expect(screen.getByRole("button", { name: "Télécharger avis.pdf" })).toBeTruthy();
  });

  it("affiche le refus du serveur pour une annonce qui ne concerne pas le locataire", async () => {
    const api = stubApi({ [`GET ${ONE}`]: problem(404, "announcement_not_found", "Annonce introuvable") });
    mount(<AnnouncementDetailPage announcementId={ANNOUNCEMENT_ID} />, `/annonces/${ANNOUNCEMENT_ID}`);
    expect(await screen.findByText("Cette annonce n’existe pas ou ne vous concerne pas.")).toBeTruthy();
    expect(api.count("POST", `${ONE}/read`)).toBe(0);
  });
});
