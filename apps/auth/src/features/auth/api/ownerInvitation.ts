import { ApiError } from "@eguardimmo/api";
import { ownerInvitationAcceptanceResponseSchema, ownerInvitationPreviewResponseSchema } from "../ownerInvitationSchemas";
import type { AuthSource, OwnerInvitationAcceptance } from "../source";
import { handled, hasFieldError, parseResponse, retryAfter, toUtc } from "./shared";
import type { AuthContext } from "./shared";

const PREVIEW_PATH = "/api/v1/owner-invitations/preview";
const ACCEPTANCE_PATH = "/api/v1/owner-invitations/acceptance";

type OwnerInvitationMethods = Pick<AuthSource, "previewOwnerInvitation" | "acceptOwnerInvitation">;

type SharedFailure =
  | { status: "invalid" }
  | { status: "email_mismatch" }
  | { status: "email_unverified" }
  | { status: "unauthenticated" }
  | { status: "rate_limited"; retryAfterSeconds: number };

function sharedFailure(error: ApiError): SharedFailure | null {
  if (error.status === 401) return { status: "unauthenticated" };
  if (error.status === 429) return { status: "rate_limited", retryAfterSeconds: retryAfter(error) };
  if (error.status === 404 && error.code === "owner_invitation_invalid") return { status: "invalid" };
  if (error.status === 403 && error.code === "owner_invitation_email_mismatch") return { status: "email_mismatch" };
  if (error.status === 403 && error.code === "email_unverified") return { status: "email_unverified" };
  if (error.status === 422 && hasFieldError(error, "token")) return { status: "invalid" };
  return null;
}

function acceptanceFailure(error: ApiError): OwnerInvitationAcceptance | null {
  if (error.status === 422 && (error.code === "owner_invitation_consent_required" || hasFieldError(error, "consent"))) {
    return { status: "consent_required" };
  }
  if (error.status === 422 && (error.code === "owner_invitation_code_invalid" || hasFieldError(error, "code"))) {
    return { status: "code_invalid" };
  }
  if (error.status === 409 && error.code === "owner_access_already_linked") return { status: "already_linked" };
  if (error.status === 409 && error.code === "owner_access_limit_reached") return { status: "limit_reached" };
  return sharedFailure(error);
}

export function ownerInvitationMethods({ client }: AuthContext): OwnerInvitationMethods {
  return {
    previewOwnerInvitation: async (token) => {
      try {
        const { data } = parseResponse(ownerInvitationPreviewResponseSchema, await client.post(PREVIEW_PATH, { token }));
        return { status: "valid", organizationName: data.organization.name, role: data.role, expiresAt: toUtc(data.expires_at) };
      } catch (error) {
        return handled<SharedFailure>(error, sharedFailure);
      }
    },
    acceptOwnerInvitation: async ({ token, code, consent }) => {
      try {
        const { data } = parseResponse(ownerInvitationAcceptanceResponseSchema, await client.post(ACCEPTANCE_PATH, { token, code, consent }));
        return { status: "accepted", role: data.role };
      } catch (error) {
        return handled<OwnerInvitationAcceptance>(error, acceptanceFailure);
      }
    },
  };
}
