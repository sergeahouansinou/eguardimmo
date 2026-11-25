import { OrgApiError } from "@/features/org/errors";
import type { RgpdSource } from "./source";
import type { PrivacyRequest } from "./schemas";

export const DEMO_PRIVACY_PER_PAGE = 3;

const SEEDS: readonly PrivacyRequest[] = [
  { id: "rgpd-2026-0005", kind: "erasure", requesterName: "Pauline Lefort", requesterEmail: "pauline.lefort@example.com", deadline: "2026-12-04T23:59:59+00:00", forwardedAt: "2026-11-05T09:12:00+00:00", handled: false, handledAt: null },
  { id: "rgpd-2026-0004", kind: "access", requesterName: "Anaïs Roux", requesterEmail: "anais.roux@example.com", deadline: "2026-11-09T23:59:59+00:00", forwardedAt: "2026-10-10T14:30:00+00:00", handled: false, handledAt: null },
  { id: "rgpd-2026-0003", kind: "rectification", requesterName: "Thomas Girard", requesterEmail: "thomas.girard@example.com", deadline: "2026-11-18T23:59:59+00:00", forwardedAt: "2026-10-19T08:45:00+00:00", handled: false, handledAt: null },
  { id: "rgpd-2026-0002", kind: "portability", requesterName: "Karim Haddad", requesterEmail: "karim.haddad@example.com", deadline: "2026-10-28T23:59:59+00:00", forwardedAt: "2026-09-28T16:05:00+00:00", handled: true, handledAt: "2026-10-12T10:20:00+00:00" },
  { id: "rgpd-2026-0001", kind: "objection", requesterName: "Julie Marchand", requesterEmail: "julie.marchand@example.com", deadline: "2026-09-30T23:59:59+00:00", forwardedAt: "2026-08-31T11:00:00+00:00", handled: true, handledAt: "2026-09-04T09:10:00+00:00" },
];

export function createDemoRgpd(): RgpdSource {
  let requests = [...SEEDS];
  return {
    list: (cursor) => {
      const start = cursor === null ? 0 : Number(cursor);
      const next = start + DEMO_PRIVACY_PER_PAGE;
      return Promise.resolve({ items: requests.slice(start, next).map((request) => ({ ...request })), nextCursor: next < requests.length ? String(next) : null });
    },
    markHandled: (id) => {
      const found = requests.find((request) => request.id === id);
      if (found === undefined) return Promise.reject(new OrgApiError("not_found", "Cette demande n’existe plus pour votre agence : rechargez la liste.", { status: 404, code: "privacy_request_not_found" }));
      if (found.handled) return Promise.resolve({ ...found });
      const handled: PrivacyRequest = { ...found, handled: true, handledAt: "2026-11-13T10:02:00+00:00" };
      requests = requests.map((request) => (request.id === id ? handled : request));
      return Promise.resolve({ ...handled });
    },
  };
}

let shared: RgpdSource | null = null;

export function demoRgpd(): RgpdSource {
  shared ??= createDemoRgpd();
  return shared;
}
