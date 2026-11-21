import type { ApiClient } from "@eguardimmo/api";
import type { AuthSource } from "../source";
import { deviceMethods } from "./devices";
import { ownerInvitationMethods } from "./ownerInvitation";
import { passwordMethods } from "./password";
import { registrationMethods } from "./registration";
import { securityMethods } from "./security";
import { sessionMethods } from "./session";
import { tenantInvitationMethods } from "./tenantInvitation";
import type { ApiAuthDependencies, AuthContext } from "./shared";

export { MISSING_RESET_EMAIL_MESSAGE } from "./password";
export { UNAVAILABLE_MESSAGE } from "./shared";

export function createApiAuthSource(client: ApiClient, { now = () => new Date() }: ApiAuthDependencies = {}): AuthSource {
  const context: AuthContext = { client, now, knowledge: { twoFactor: null, passwordConfirmedAt: null } };
  return {
    kind: "api",
    now,
    ...sessionMethods(context),
    ...tenantInvitationMethods(context),
    ...ownerInvitationMethods(context),
    ...registrationMethods(context),
    ...passwordMethods(context),
    ...securityMethods(context),
    ...deviceMethods(context),
  };
}
