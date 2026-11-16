import { ApiError } from "@eguardimmo/api";
import type { ApiClient } from "@eguardimmo/api";
import type { AuthSource, RegisterInput, RequestResult } from "../source";
import { handled, retryAfter, unavailable } from "./shared";
import type { AuthContext } from "./shared";

const INTENDED_PROFILES = { bailleur: "individual_landlord", agence: "agency", voyageur: "traveler" } as const;
const SIGNED_PATH = /^\/api\/v1\/auth\/email\/verify\/[^/]+\/[^/]+$/;

type RegistrationMethods = Pick<
  AuthSource,
  "register" | "getVerificationStatus" | "resendVerification" | "verifyEmail" | "getInvitation" | "acceptInvitation"
>;

function displayName(input: RegisterInput): string {
  return input.profile === "agence" ? input.agencyName : `${input.firstName} ${input.lastName}`.trim();
}

function signedTarget(client: ApiClient, link: string): string | null {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return null;
  }
  if (url.origin !== new URL(client.baseUrl).origin || !SIGNED_PATH.test(url.pathname)) return null;
  return `${url.pathname}${url.search}`;
}

export function registrationMethods({ client }: AuthContext): RegistrationMethods {
  return {
    register: async (input) => {
      try {
        await client.post("/auth/register", {
          name: displayName(input),
          email: input.email,
          password: input.password,
          password_confirmation: input.password,
          intended_profile: INTENDED_PROFILES[input.profile],
        });
        return { status: "sent" };
      } catch (error) {
        return handled<RequestResult>(error, (failure) =>
          failure.status === 429 ? { status: "rate_limited", retryAfterSeconds: retryAfter(failure) } : null,
        );
      }
    },
    getVerificationStatus: unavailable(),
    resendVerification: async (email) => {
      try {
        await client.post("/api/v1/auth/email/verification-notification", { email });
        return { status: "sent" };
      } catch (error) {
        return handled<RequestResult>(error, (failure) =>
          failure.status === 429 ? { status: "rate_limited", retryAfterSeconds: retryAfter(failure) } : null,
        );
      }
    },
    verifyEmail: async (token) => {
      const target = signedTarget(client, token);
      if (target === null) return { status: "expired" };
      try {
        await client.post(target);
        return { status: "verified" };
      } catch (error) {
        if (error instanceof ApiError && error.status === 403) return { status: "expired" };
        throw error;
      }
    },
    getInvitation: unavailable(),
    acceptInvitation: unavailable(),
  };
}
