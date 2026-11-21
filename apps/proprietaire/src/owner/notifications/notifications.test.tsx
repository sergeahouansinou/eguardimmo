import { NotificationsApiProvider } from "@eguardimmo/shell";
import { screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApi, stubApi } from "../../../test/api";
import { expectNoA11yViolations } from "../../../test/axe";
import { setLocation } from "../../../test/navigation";
import { AGENCY_ID } from "../responses.fixtures";
import { useOwnerSession } from "../session";
import { CentreApi } from "./CentreApi";
import { PreferencesApi } from "./PreferencesApi";

vi.mock("next/navigation", async () => (await import("../../../test/navigation")).navigationMock);
vi.mock("next/link", async () => (await import("../../../test/navigation")).linkMock);

const FEED = "GET /api/v1/notifications";
const UNREAD = "GET /api/v1/notifications/unread-count";
const PREFERENCES = "GET /api/v1/notifications/preferences";
const INTERVENTION = "0193a5e1-0000-7000-8000-0000000000e1";

const entry = (id: string, type: string, title: string, href: string, unread = true) => ({
  id,
  type,
  tone: "info",
  title,
  detail: "Détail serveur.",
  unread,
  href,
  organization_id: AGENCY_ID,
  created_at: "2026-11-19T10:00:00+00:00",
  read_at: unread ? null : "2026-11-19T11:00:00+00:00",
});

const FEED_BODY = {
  data: [
    entry("0193a5e1-0000-7000-8000-0000000000f1", "owner.approval_requested", "Accord demandé", `/interventions/${INTERVENTION}`),
    entry("0193a5e1-0000-7000-8000-0000000000f2", "owner.payout_executed", "Reversement exécuté", "/reversements"),
    entry("0193a5e1-0000-7000-8000-0000000000f3", "owner.account_change_requested", "Changement de compte de paiement demandé", "/compte-de-paiement", false),
    entry("0193a5e1-0000-7000-8000-0000000000f4", "owner.report_published", "Compte rendu de gestion disponible", "/comptes-rendus", false),
  ],
  links: { first: null, last: null, prev: null, next: null },
  meta: { path: "http://api.test/api/v1/notifications", per_page: 25, next_cursor: null, prev_cursor: null },
};

const channels = [
  { channel: "in_app", label: "Application", enabled: true, locked: false },
  { channel: "email", label: "E-mail", enabled: true, locked: false },
  { channel: "push", label: "Mobile", enabled: false, locked: false },
];

const PREFERENCES_BODY = {
  data: {
    types: [
      { type: "owner.approval_requested", label: "Accord demandé", group: "Interventions", audience: "owner", channels },
      { type: "owner.payout_executed", label: "Reversement exécuté", group: "Reversements", audience: "owner", channels },
      { type: "rent.overdue", label: "Loyer en retard", group: "Finances", audience: "staff", channels },
    ],
  },
};

function WithNotifications({ children }: { children: ReactNode }) {
  const { client } = useOwnerSession();
  return (
    <NotificationsApiProvider client={client} organizationId={null}>
      {children}
    </NotificationsApiProvider>
  );
}

beforeEach(() => {
  setLocation("/confie/notifications/toutes");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("notifications du propriétaire en mode api", () => {
  it("liste les notifications du propriétaire avec des liens vers des pages réelles", async () => {
    stubApi({ [FEED]: { body: FEED_BODY }, [UNREAD]: { body: { data: { unread: 2 } } } });
    const { container } = renderApi(
      <WithNotifications>
        <CentreApi />
      </WithNotifications>,
    );

    expect(await screen.findByText("Accord demandé")).toBeTruthy();
    const hrefs = screen.getAllByRole("link").map((link) => link.getAttribute("href"));
    expect(hrefs).toContain(`/confie/interventions/${INTERVENTION}`);
    expect(hrefs).toContain("/confie/loyers");
    expect(hrefs).toContain("/confie/compte-de-paiement");
    expect(hrefs).toContain("/confie/comptes-rendus");
    expect(hrefs).toContain("/confie/notifications");
    expect(hrefs.some((href) => href?.includes("/confie/reversements"))).toBe(false);
    await expectNoA11yViolations(container);
  });

  it("n'affiche que les préférences du propriétaire", async () => {
    stubApi({ [PREFERENCES]: { body: PREFERENCES_BODY } });
    renderApi(
      <WithNotifications>
        <PreferencesApi />
      </WithNotifications>,
    );

    const form = await screen.findByRole("form", { name: "Préférences de notification du propriétaire" });
    expect(within(form).getByRole("switch", { name: "Accord demandé, E-mail" })).toBeTruthy();
    expect(within(form).queryByText("Loyer en retard")).toBeNull();
    expect(screen.getByRole("link", { name: "Voir toutes les notifications" }).getAttribute("href")).toBe("/confie/notifications/toutes");
  });
});
