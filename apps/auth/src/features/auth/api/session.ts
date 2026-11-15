import { ApiError } from "@eguardimmo/api";
import type { Session } from "../schemas";
import type { AuthSource, SignInResult, TwoFactorResult } from "../source";
import { toProfiles } from "./profiles";
import { loginResponseSchema, meResponseSchema } from "./responses";
import { handled, parseResponse, retryAfter, unavailable } from "./shared";
import type { AuthContext } from "./shared";

function toSession(payload: unknown): Session {
  const user = parseResponse(meResponseSchema, payload).data;
  const [firstName = user.name, ...rest] = user.name.trim().split(/\s+/);
  return { userId: user.id, firstName, lastName: rest.join(" "), email: user.email };
}

type SessionMethods = Pick<
  AuthSource,
  | "getSession"
  | "signIn"
  | "verifyTwoFactor"
  | "verifyBackupCode"
  | "signOut"
  | "listProfiles"
  | "selectProfile"
  | "socialIdentities"
  | "socialSignIn"
>;

export function sessionMethods(context: AuthContext): SessionMethods {
  const { client, knowledge } = context;

  const completeChallenge = async (body: { code: string } | { recovery_code: string }): Promise<TwoFactorResult> => {
    try {
      await client.post("/auth/two-factor-challenge", body);
      knowledge.twoFactor = true;
      return { status: "authenticated" };
    } catch (error) {
      return handled<TwoFactorResult>(error, (failure) => {
        if (failure.status === 422) return { status: "invalid_code" };
        if (failure.status === 429) return { status: "locked", retryAfterSeconds: retryAfter(failure) };
        return null;
      });
    }
  };

  return {
    getSession: async () => {
      try {
        return toSession(await client.get("/api/v1/me"));
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    signIn: async ({ email, password }) => {
      try {
        const { two_factor } = parseResponse(loginResponseSchema, await client.post("/auth/login", { email, password }));
        knowledge.twoFactor = two_factor;
        return two_factor ? { status: "two_factor_required" } : { status: "authenticated" };
      } catch (error) {
        return handled<SignInResult>(error, (failure) => {
          if (failure.status === 422) return { status: "invalid_credentials" };
          if (failure.status === 429) return { status: "locked", retryAfterSeconds: retryAfter(failure) };
          return null;
        });
      }
    },
    verifyTwoFactor: (code) => completeChallenge({ code }),
    verifyBackupCode: (code) => completeChallenge({ recovery_code: code }),
    signOut: async () => {
      knowledge.twoFactor = null;
      knowledge.passwordConfirmedAt = null;
      try {
        await client.post("/auth/logout");
      } catch (error) {
        if (!(error instanceof ApiError && error.status === 401)) throw error;
      }
    },
    listProfiles: async () => toProfiles(await client.get("/api/v1/me/profiles")),
    selectProfile: () => Promise.resolve(),
    socialIdentities: () => [],
    socialSignIn: unavailable(),
  };
}
