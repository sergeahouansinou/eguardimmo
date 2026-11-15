"use client";

import { createContext, use } from "react";
import type { ReactNode } from "react";
import type { InvitationDetail, RegisterProfile, SocialProvider } from "./schemas";

export type SocialIntent = "connexion" | "inscription" | "invitation";

export interface SignInInput {
  email: string;
  password: string;
}

export type SignInResult =
  | { status: "authenticated" }
  | { status: "two_factor_required" }
  | { status: "invalid_credentials" }
  | { status: "locked"; retryAfterSeconds: number };

export type TwoFactorResult =
  | { status: "authenticated" }
  | { status: "invalid_code" }
  | { status: "locked"; retryAfterSeconds: number }
  | { status: "challenge_expired" };

export interface SocialSignInInput {
  provider: SocialProvider;
  intent: SocialIntent;
  identityId: string;
  profile?: RegisterProfile;
  invitationToken?: string;
}

export type SocialResult =
  | { status: "authenticated" }
  | { status: "two_factor_required" }
  | { status: "account_not_found" }
  | { status: "link_required" };

export interface SocialIdentity {
  id: string;
  label: string;
  description: string;
}

export type RegisterInput =
  | { profile: Extract<RegisterProfile, "bailleur" | "voyageur">; firstName: string; lastName: string; email: string; password: string }
  | { profile: "agence"; agencyName: string; siren: string; email: string; password: string };

export type RequestResult = { status: "sent" } | { status: "rate_limited"; retryAfterSeconds: number };

export type ConfirmationResult =
  | { status: "confirmed" }
  | { status: "invalid" }
  | { status: "locked"; retryAfterSeconds: number };

export type ProtectedResult<T = object> = ({ status: "ok" } & T) | { status: "confirmation_required"; needsCode: boolean };

export type ChangePasswordResult =
  | { status: "ok" }
  | { status: "invalid_current" }
  | { status: "confirmation_required"; needsCode: boolean };

export type TwoFactorSetupResult =
  | { status: "ok"; backupCodes: string[] }
  | { status: "invalid_code" }
  | { status: "confirmation_required"; needsCode: boolean };

export type LinkResult =
  | { status: "ok" }
  | { status: "conflict" }
  | { status: "confirmation_required"; needsCode: boolean };

export type UnlinkResult =
  | { status: "ok" }
  | { status: "last_login_method" }
  | { status: "confirmation_required"; needsCode: boolean };

export type DeleteAccountResult =
  | { status: "deleted" }
  | { status: "confirmation_required"; needsCode: boolean };

export interface TwoFactorSetup {
  secret: string;
  otpauthUri: string;
}

export interface AuthSource {
  kind: "demo" | "api";
  now: () => Date;
  getSession: () => Promise<unknown>;
  signIn: (input: SignInInput) => Promise<SignInResult>;
  verifyTwoFactor: (code: string) => Promise<TwoFactorResult>;
  verifyBackupCode: (code: string) => Promise<TwoFactorResult>;
  socialIdentities: (intent: SocialIntent) => SocialIdentity[];
  socialSignIn: (input: SocialSignInInput) => Promise<SocialResult>;
  signOut: () => Promise<void>;
  register: (input: RegisterInput) => Promise<RequestResult>;
  getVerificationStatus: () => Promise<unknown>;
  resendVerification: () => Promise<RequestResult>;
  verifyEmail: (token: string) => Promise<{ status: "verified" } | { status: "expired" }>;
  requestPasswordReset: (email: string) => Promise<RequestResult>;
  checkResetToken: (input: { token: string; email: string }) => Promise<{ status: "valid" } | { status: "expired" }>;
  resetPassword: (input: { token: string; email: string; password: string }) => Promise<
    { status: "ok" } | { status: "expired" } | { status: "reused" }
  >;
  requestPasswordDefinition: () => Promise<RequestResult>;
  getInvitation: (token: string) => Promise<unknown>;
  acceptInvitation: (input: { token: string; password: string }) => Promise<{ status: "activated" } | { status: "invalid" }>;
  listProfiles: () => Promise<unknown>;
  selectProfile: (profileId: string) => Promise<void>;
  getSecurity: () => Promise<unknown>;
  confirmPassword: (password: string) => Promise<ConfirmationResult>;
  confirmCode: (code: string) => Promise<ConfirmationResult>;
  changePassword: (input: { current: string; password: string }) => Promise<ChangePasswordResult>;
  changeEmail: (email: string) => Promise<ProtectedResult>;
  startTwoFactorSetup: () => Promise<TwoFactorSetup>;
  enableTwoFactor: (code: string) => Promise<TwoFactorSetupResult>;
  disableTwoFactor: () => Promise<ProtectedResult>;
  regenerateBackupCodes: () => Promise<ProtectedResult<{ backupCodes: string[] }>>;
  linkProvider: (input: { provider: SocialProvider; identityId: string }) => Promise<LinkResult>;
  unlinkProvider: (provider: SocialProvider) => Promise<UnlinkResult>;
  signOutDevice: (deviceId: string) => Promise<void>;
  signOutOtherDevices: () => Promise<void>;
  deleteAccount: () => Promise<DeleteAccountResult>;
}

export type { InvitationDetail };

const SourceContext = createContext<AuthSource | null>(null);

export function AuthSourceProvider({ source, children }: { source: AuthSource; children: ReactNode }) {
  return <SourceContext value={source}>{children}</SourceContext>;
}

export function useAuthSource(): AuthSource {
  const source = use(SourceContext);
  if (!source) throw new Error("AuthSourceProvider manquant autour de l’application.");
  return source;
}
