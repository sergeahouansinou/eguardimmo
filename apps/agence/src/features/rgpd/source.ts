import type { ApiClient } from "@eguardimmo/api";
import { createOrgTransport } from "@/features/org/transport";
import type { Page } from "@/features/org/schemas";
import { privacyRequestResponse, privacyRequestsResponse } from "./schemas";
import type { PrivacyRequest } from "./schemas";

export const PRIVACY_PER_PAGE = 25;

export interface RgpdSource {
  list: (cursor: string | null) => Promise<Page<PrivacyRequest>>;
  markHandled: (id: string) => Promise<PrivacyRequest>;
}

const MESSAGES: Readonly<Record<string, string>> = {
  role_forbidden: "Seuls le titulaire et les administrateurs de l’agence voient et traitent les demandes RGPD.",
  privacy_request_not_found: "Cette demande n’existe plus pour votre agence : rechargez la liste.",
};

export function createApiRgpdSource(options: { client: ApiClient; organizationId: string | null }): RgpdSource {
  const transport = createOrgTransport(options.client, options.organizationId, { messages: MESSAGES });
  return {
    list: (cursor) => transport.get("/privacy-requests", privacyRequestsResponse, { per_page: PRIVACY_PER_PAGE, cursor }),
    markHandled: (id) => transport.post(`/privacy-requests/${encodeURIComponent(id)}/handled`, privacyRequestResponse),
  };
}
