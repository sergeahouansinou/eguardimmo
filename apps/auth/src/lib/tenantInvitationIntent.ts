"use client";

import { useSyncExternalStore } from "react";
import { tenantInvitationTokenSchema } from "@/features/auth/schemas";

const STORAGE_KEY = "eguardimmo.auth.tenant-invitation";

function storage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function rememberTenantInvitation(token: string): void {
  try {
    storage()?.setItem(STORAGE_KEY, token);
  } catch {
    return;
  }
}

export function forgetTenantInvitation(): void {
  try {
    storage()?.removeItem(STORAGE_KEY);
  } catch {
    return;
  }
}

export function readTenantInvitation(): string | null {
  try {
    const parsed = tenantInvitationTokenSchema.safeParse(storage()?.getItem(STORAGE_KEY));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

const subscribeNothing = () => () => undefined;

export function useHasPendingTenantInvitation(): boolean {
  return useSyncExternalStore(subscribeNothing, () => readTenantInvitation() !== null, () => false);
}
