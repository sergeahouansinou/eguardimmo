"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { z } from "zod";
import { invitationDetailSchema, profileSchema, securitySchema, sessionSchema, verificationStatusSchema } from "./schemas";
import { useAuthSource } from "./source";
import type { AuthSource, RegisterInput, SignInInput, SocialSignInInput } from "./source";
import type { SocialProvider } from "./schemas";

export const authKeys = {
  all: ["auth"] as const,
  session: ["auth", "session"] as const,
  profiles: ["auth", "profiles"] as const,
  security: ["auth", "security"] as const,
  verification: ["auth", "verification"] as const,
  setup: ["auth", "setup"] as const,
  invitation: (token: string) => ["auth", "invitation", token] as const,
  resetToken: (token: string) => ["auth", "reset-token", token] as const,
};

const subscribeNothing = () => () => undefined;

export function useHydrated(): boolean {
  return useSyncExternalStore(subscribeNothing, () => true, () => false);
}

export interface AuthQuery<T> {
  data: T | undefined;
  isError: boolean;
  isPending: boolean;
  refetch: () => void;
}

function useAuthQuery<T>(
  key: readonly unknown[],
  read: (source: AuthSource) => Promise<unknown>,
  schema: z.ZodType<T>,
  enabled = true,
): AuthQuery<T> {
  const source = useAuthSource();
  const hydrated = useHydrated();
  const query = useQuery({
    queryKey: key,
    queryFn: async () => schema.parse(await read(source)),
    enabled,
    retry: false,
  });
  const refetch = () => void query.refetch();
  if (!hydrated) return { data: undefined, isError: false, isPending: true, refetch };
  return { data: query.data, isError: query.isError, isPending: query.isPending, refetch };
}

export const useSession = () => useAuthQuery(authKeys.session, (s) => s.getSession(), sessionSchema.nullable());

export const useProfiles = (enabled = true) =>
  useAuthQuery(authKeys.profiles, (s) => s.listProfiles(), z.array(profileSchema), enabled);

export const useSecurity = (enabled = true) =>
  useAuthQuery(authKeys.security, (s) => s.getSecurity(), securitySchema, enabled);

export const useVerificationStatus = () =>
  useAuthQuery(authKeys.verification, (s) => s.getVerificationStatus(), verificationStatusSchema);

const invitationResultSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("valid"), invitation: invitationDetailSchema }),
  z.object({ status: z.literal("invalid") }),
]);

export const useInvitation = (token: string) =>
  useAuthQuery(authKeys.invitation(token), (s) => s.getInvitation(token), invitationResultSchema);

const setupSchema = z.object({ secret: z.string().min(1), otpauthUri: z.string().min(1) });

export function useTwoFactorSetup(enabled: boolean) {
  const source = useAuthSource();
  const hydrated = useHydrated();
  const query = useQuery({
    queryKey: authKeys.setup,
    queryFn: async () => setupSchema.parse(await source.startTwoFactorSetup()),
    enabled,
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
  });
  return hydrated
    ? { data: query.data, isError: query.isError, isPending: query.isPending, refetch: () => void query.refetch() }
    : { data: undefined, isError: false, isPending: true, refetch: () => undefined };
}

export function useResetTokenCheck(token: string) {
  const source = useAuthSource();
  const hydrated = useHydrated();
  const query = useQuery({
    queryKey: authKeys.resetToken(token),
    queryFn: () => source.checkResetToken(token),
    retry: false,
  });
  return hydrated ? query : { ...query, data: undefined, isPending: true };
}

function useAuthMutation<A, R>(run: (source: AuthSource, argument: A) => Promise<R>) {
  const source = useAuthSource();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (argument: A) => run(source, argument),
    onSuccess: () => client.invalidateQueries({ queryKey: authKeys.all }),
  });
}

export const useSignIn = () => useAuthMutation((s, input: SignInInput) => s.signIn(input));
export const useVerifyTwoFactor = () => useAuthMutation((s, code: string) => s.verifyTwoFactor(code));
export const useVerifyBackupCode = () => useAuthMutation((s, code: string) => s.verifyBackupCode(code));
export const useSocialSignIn = () => useAuthMutation((s, input: SocialSignInInput) => s.socialSignIn(input));
export const useSignOut = () => useAuthMutation((s) => s.signOut());
export const useRegister = () => useAuthMutation((s, input: RegisterInput) => s.register(input));
export const useResendVerification = () => useAuthMutation((s) => s.resendVerification());
export const useVerifyEmail = () => useAuthMutation((s, token: string) => s.verifyEmail(token));
export const useRequestPasswordReset = () => useAuthMutation((s, email: string) => s.requestPasswordReset(email));
export const useResetPassword = () =>
  useAuthMutation((s, input: { token: string; password: string }) => s.resetPassword(input));
export const useRequestPasswordDefinition = () => useAuthMutation((s) => s.requestPasswordDefinition());
export const useAcceptInvitation = () =>
  useAuthMutation((s, input: { token: string; password: string }) => s.acceptInvitation(input));
export const useSelectProfile = () => useAuthMutation((s, profileId: string) => s.selectProfile(profileId));
export const useConfirmPassword = () => useAuthMutation((s, password: string) => s.confirmPassword(password));
export const useConfirmCode = () => useAuthMutation((s, code: string) => s.confirmCode(code));
export const useChangePassword = () =>
  useAuthMutation((s, input: { current: string; password: string }) => s.changePassword(input));
export const useChangeEmail = () => useAuthMutation((s, email: string) => s.changeEmail(email));
export const useEnableTwoFactor = () => useAuthMutation((s, code: string) => s.enableTwoFactor(code));
export const useDisableTwoFactor = () => useAuthMutation((s) => s.disableTwoFactor());
export const useRegenerateBackupCodes = () => useAuthMutation((s) => s.regenerateBackupCodes());
export const useLinkProvider = () =>
  useAuthMutation((s, input: { provider: SocialProvider; identityId: string }) => s.linkProvider(input));
export const useUnlinkProvider = () => useAuthMutation((s, provider: SocialProvider) => s.unlinkProvider(provider));
export const useSignOutDevice = () => useAuthMutation((s, deviceId: string) => s.signOutDevice(deviceId));
export const useSignOutOtherDevices = () => useAuthMutation((s) => s.signOutOtherDevices());
export const useDeleteAccount = () => useAuthMutation((s) => s.deleteAccount());
