import { OrganizationGate } from "@eguardimmo/shell";
import { ToastProvider, TooltipProvider } from "@eguardimmo/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { vi } from "vitest";
import { ID, ORG, mockApi, orgPath, problem } from "../../api/testing";
import type { MockRoute } from "../../api/testing";

export const PERSON_ID = "01934f6e-0000-7000-8000-0000000000b9";
export const ACCESS_ID = "01934f6e-0000-7000-8000-0000000000c9";
export const INVITATION_ID = "01934f6e-0000-7000-8000-0000000000c8";
export const PAIRING_CODE = "482915";
export const OWNER_ACCESS_PATH = orgPath(`/parties/${ID.mandant}/owner-access`);

export const ownerState = (overrides: Record<string, unknown> = {}) => ({
  data: {
    party_id: ID.mandant,
    accesses: [{ id: ACCESS_ID, role: "holder", person_party_id: null, email_hint: "a***@exemple.fr", linked_at: "2026-11-02T09:30:00+00:00" }],
    invitations: [{ id: INVITATION_ID, role: "co_owner", person_party_id: PERSON_ID, email_hint: "j***@exemple.fr", expires_at: "2026-11-30T10:00:00+00:00", attempts_remaining: 3 }],
    ...overrides,
  },
});

export const issued = (role = "holder") => ({
  data: {
    party_id: ID.mandant,
    invitation: { id: INVITATION_ID, role, person_party_id: null, email_hint: "a***@exemple.fr", expires_at: "2026-12-03T10:00:00+00:00", attempts_remaining: 5 },
    pairing_code: PAIRING_CODE,
  },
});

export const partiesPage = {
  data: [
    { id: ID.mandant, kind: "person", display_name: "Claire Vasseur", is_anonymized: false, archived_at: null },
    { id: PERSON_ID, kind: "person", display_name: "Jules Vasseur", is_anonymized: false, archived_at: null },
    { id: ID.company, kind: "company", display_name: "SCI Horizon", is_anonymized: false, archived_at: null },
  ],
  meta: { per_page: 100, next_cursor: null },
};

export function renderOwnerAccess(ui: ReactElement, routes: Record<string, MockRoute> = {}, role: "owner" | "accountant" = "owner") {
  const api = mockApi({
    "GET /sanctum/csrf-cookie": { status: 204 },
    "GET /api/v1/me/profiles": { body: { data: [{ space: "organization", label: "Agence Soleil", meta: { organization: ORG, kind: "agency", role } }] } },
    [`GET ${OWNER_ACCESS_PATH}`]: { body: ownerState() },
    [`GET ${orgPath("/parties")}`]: { body: partiesPage },
    ...routes,
  });
  vi.stubGlobal("fetch", api.fetchImpl);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 }, mutations: { retry: false } } });
  const user = userEvent.setup();
  const view = render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <ToastProvider>
          <OrganizationGate apiUrl="https://api.test" authUrl="https://auth.test" kind="agency">
            {ui}
          </OrganizationGate>
        </ToastProvider>
      </TooltipProvider>
    </QueryClientProvider>,
  );
  return { ...api, ...view, user, client };
}

export { problem };
