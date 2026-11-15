import type {
  AuthSource,
  ConfirmationResult,
  DeleteAccountResult,
  ProtectedResult,
  TwoFactorSetupResult,
} from "../source";
import { qrCodeResponseSchema, recoveryCodesResponseSchema, secretKeyResponseSchema, securityResponseSchema } from "./responses";
import { handled, hasFieldError, parseResponse, retryAfter, toUtc, unavailable } from "./shared";
import type { AuthContext } from "./shared";

const RECENT_PASSWORD_CONFIRMATION_MS = 5 * 60_000;
const SETUP_BASE = "/auth/user/two-factor-authentication";
const RECOVERY_CODES = "/auth/user/two-factor-recovery-codes";

type SecurityMethods = Pick<
  AuthSource,
  | "getSecurity"
  | "confirmPassword"
  | "confirmCode"
  | "changeEmail"
  | "startTwoFactorSetup"
  | "enableTwoFactor"
  | "disableTwoFactor"
  | "regenerateBackupCodes"
  | "linkProvider"
  | "unlinkProvider"
  | "deleteAccount"
>;

const PASSWORD_CONFIRMATION_REQUIRED = { status: "confirmation_required", needsCode: false } as const;

export function securityMethods(context: AuthContext): SecurityMethods {
  const { client, knowledge, now } = context;

  const confirm = async (run: () => Promise<unknown>, onConfirmed: () => void): Promise<ConfirmationResult> => {
    try {
      await run();
      onConfirmed();
      return { status: "confirmed" };
    } catch (error) {
      return handled<ConfirmationResult>(error, (failure) => {
        if (failure.status === 422) return { status: "invalid" };
        if (failure.status === 429) return { status: "locked", retryAfterSeconds: retryAfter(failure) };
        return null;
      });
    }
  };

  const protectedAction = async <T extends object>(run: () => Promise<T>): Promise<ProtectedResult<T>> => {
    try {
      return { status: "ok", ...(await run()) };
    } catch (error) {
      return handled<ProtectedResult<T>>(error, (failure) => (failure.status === 423 ? PASSWORD_CONFIRMATION_REQUIRED : null));
    }
  };

  const readRecoveryCodes = async () => parseResponse(recoveryCodesResponseSchema, await client.get(RECOVERY_CODES));

  const needsCodeToDelete = (): boolean => {
    if (knowledge.twoFactor !== null) return knowledge.twoFactor;
    const confirmedAt = knowledge.passwordConfirmedAt;
    return confirmedAt !== null && now().getTime() - confirmedAt < RECENT_PASSWORD_CONFIRMATION_MS;
  };

  return {
    getSecurity: async () => {
      const { data } = parseResponse(securityResponseSchema, await client.get("/api/v1/me/security"));
      knowledge.twoFactor = data.two_factor.enabled;
      return {
        email: data.email,
        emailVerified: data.email_verified,
        hasPassword: data.has_password,
        passwordChangedAt: null,
        twoFactor: {
          enabled: data.two_factor.enabled,
          enabledAt: toUtc(data.two_factor.enabled_at),
          backupCodesRemaining: data.two_factor.backup_codes_remaining,
          backupCodesTotal: data.two_factor.backup_codes_total,
        },
        linkedAccounts: data.linked_accounts.map((account) => ({
          provider: account.provider,
          linked: account.linked,
          email: account.email,
          linkedAt: toUtc(account.linked_at),
        })),
        devices: data.devices.map((device) => ({
          id: device.id,
          name: device.name,
          type: device.type,
          location: null,
          lastActivityAt: toUtc(device.last_activity_at),
          current: device.current,
        })),
        confirmedUntil: toUtc(data.confirmed_until),
        confirmedWithCodeUntil: toUtc(data.confirmed_with_code_until),
      };
    },
    confirmPassword: (password) =>
      confirm(
        () => client.post("/auth/user/confirm-password", { password }),
        () => {
          knowledge.passwordConfirmedAt = now().getTime();
        },
      ),
    confirmCode: (code) =>
      confirm(
        () => client.post("/auth/reauthenticate/two-factor", { code }),
        () => {
          knowledge.twoFactor = true;
        },
      ),
    changeEmail: unavailable(),
    startTwoFactorSetup: async () => {
      await client.post(SETUP_BASE);
      const { secretKey } = parseResponse(secretKeyResponseSchema, await client.get("/auth/user/two-factor-secret-key"));
      const { url } = parseResponse(qrCodeResponseSchema, await client.get("/auth/user/two-factor-qr-code"));
      return { secret: secretKey, otpauthUri: url };
    },
    enableTwoFactor: async (code) => {
      try {
        await client.post("/auth/user/confirmed-two-factor-authentication", { code });
        knowledge.twoFactor = true;
        return { status: "ok", backupCodes: await readRecoveryCodes() };
      } catch (error) {
        return handled<TwoFactorSetupResult>(error, (failure) => {
          if (failure.status === 423) return PASSWORD_CONFIRMATION_REQUIRED;
          if (failure.status === 422 && hasFieldError(failure, "code")) return { status: "invalid_code" };
          return null;
        });
      }
    },
    disableTwoFactor: () =>
      protectedAction(async () => {
        await client.delete(SETUP_BASE);
        knowledge.twoFactor = false;
        return {};
      }),
    regenerateBackupCodes: () =>
      protectedAction(async () => {
        await client.post(RECOVERY_CODES);
        return { backupCodes: await readRecoveryCodes() };
      }),
    linkProvider: unavailable(),
    unlinkProvider: unavailable(),
    deleteAccount: async () => {
      try {
        await client.delete("/api/v1/me");
        knowledge.twoFactor = null;
        knowledge.passwordConfirmedAt = null;
        return { status: "deleted" };
      } catch (error) {
        return handled<DeleteAccountResult>(error, (failure) =>
          failure.status === 403 && failure.code === "reauthentication_required"
            ? { status: "confirmation_required", needsCode: needsCodeToDelete() }
            : null,
        );
      }
    },
  };
}
