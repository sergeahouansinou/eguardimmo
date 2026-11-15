import type { AuthSource, ChangePasswordResult, RequestResult } from "../source";
import { resetStatusResponseSchema } from "./responses";
import { handled, hasFieldError, parseResponse, retryAfter, unavailable } from "./shared";
import type { AuthContext } from "./shared";

export const MISSING_RESET_EMAIL_MESSAGE = "Le lien de réinitialisation est incomplet : l’adresse e-mail est manquante.";

type PasswordMethods = Pick<
  AuthSource,
  "requestPasswordReset" | "checkResetToken" | "resetPassword" | "requestPasswordDefinition" | "changePassword"
>;

export function passwordMethods({ client }: AuthContext): PasswordMethods {
  return {
    requestPasswordReset: async (email) => {
      try {
        await client.post("/auth/forgot-password", { email });
        return { status: "sent" };
      } catch (error) {
        return handled<RequestResult>(error, (failure) =>
          failure.status === 429 ? { status: "rate_limited", retryAfterSeconds: retryAfter(failure) } : null,
        );
      }
    },
    checkResetToken: async ({ token, email }) => {
      if (token === "" || email === "") return { status: "expired" };
      const payload = await client.post("/api/v1/auth/password-reset/status", { token, email });
      return { status: parseResponse(resetStatusResponseSchema, payload).data.status };
    },
    resetPassword: async ({ token, email, password }) => {
      if (email === "") throw new Error(MISSING_RESET_EMAIL_MESSAGE);
      try {
        await client.post("/auth/reset-password", { token, email, password, password_confirmation: password });
        return { status: "ok" };
      } catch (error) {
        return handled<{ status: "expired" }>(error, (failure) =>
          failure.status === 422 && hasFieldError(failure, "email") ? { status: "expired" } : null,
        );
      }
    },
    requestPasswordDefinition: unavailable(),
    changePassword: async ({ current, password }) => {
      try {
        await client.put("/auth/user/password", {
          current_password: current,
          password,
          password_confirmation: password,
        });
        return { status: "ok" };
      } catch (error) {
        return handled<ChangePasswordResult>(error, (failure) =>
          failure.status === 422 && hasFieldError(failure, "current_password") ? { status: "invalid_current" } : null,
        );
      }
    },
  };
}
