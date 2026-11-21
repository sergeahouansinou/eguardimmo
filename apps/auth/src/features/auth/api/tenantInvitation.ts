import { ApiError } from "@eguardimmo/api";
import type { AuthSource, TenantInvitationAcceptance } from "../source";
import { tenantInvitationAcceptanceResponseSchema, tenantInvitationPreviewResponseSchema } from "./responses";
import { handled, hasFieldError, parseResponse, retryAfter, toUtc } from "./shared";
import type { AuthContext } from "./shared";

const PREVIEW_PATH = "/api/v1/tenant-invitations/preview";
const ACCEPTANCE_PATH = "/api/v1/tenant-invitations/acceptance";

type TenantInvitationMethods = Pick<AuthSource, "previewTenantInvitation" | "acceptTenantInvitation">;

type SharedFailure =
  | { status: "invalid" }
  | { status: "email_mismatch" }
  | { status: "email_unverified" }
  | { status: "unauthenticated" }
  | { status: "rate_limited"; retryAfterSeconds: number };

function sharedFailure(error: ApiError): SharedFailure | null {
  if (error.status === 401) return { status: "unauthenticated" };
  if (error.status === 429) return { status: "rate_limited", retryAfterSeconds: retryAfter(error) };
  if (error.status === 404 && error.code === "tenant_invitation_invalid") return { status: "invalid" };
  if (error.status === 403 && error.code === "tenant_invitation_email_mismatch") return { status: "email_mismatch" };
  if (error.status === 403 && error.code === "email_unverified") return { status: "email_unverified" };
  if (error.status === 422 && hasFieldError(error, "token")) return { status: "invalid" };
  return null;
}

export function tenantInvitationMethods({ client }: AuthContext): TenantInvitationMethods {
  return {
    previewTenantInvitation: async (token) => {
      try {
        const { data } = parseResponse(tenantInvitationPreviewResponseSchema, await client.post(PREVIEW_PATH, { token }));
        return { status: "valid", organizationName: data.organization.name, expiresAt: toUtc(data.expires_at) };
      } catch (error) {
        return handled<SharedFailure>(error, sharedFailure);
      }
    },
    acceptTenantInvitation: async ({ token, consent }) => {
      try {
        parseResponse(tenantInvitationAcceptanceResponseSchema, await client.post(ACCEPTANCE_PATH, { token, consent }));
        return { status: "accepted" };
      } catch (error) {
        return handled<TenantInvitationAcceptance>(error, (failure) => {
          if (failure.status === 422 && (failure.code === "tenant_invitation_consent_required" || hasFieldError(failure, "consent"))) {
            return { status: "consent_required" };
          }
          if (failure.status === 409 && failure.code === "tenant_account_already_linked") return { status: "account_already_linked" };
          if (failure.status === 409 && failure.code === "party_already_linked") return { status: "party_already_linked" };
          return sharedFailure(failure);
        });
      }
    },
  };
}
