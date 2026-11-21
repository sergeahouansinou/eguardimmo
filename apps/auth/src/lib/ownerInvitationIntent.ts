"use client";

import { useSyncExternalStore } from "react";
import { ownerInvitationTokenSchema } from "@/features/auth/ownerInvitationSchemas";

const STORAGE_KEY = "eguardimmo.auth.owner-invitation";

function storage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function rememberOwnerInvitation(token: string): void {
  try {
    storage()?.setItem(STORAGE_KEY, token);
  } catch {
    return;
  }
}

export function forgetOwnerInvitation(): void {
  try {
    storage()?.removeItem(STORAGE_KEY);
  } catch {
    return;
  }
}

export function readOwnerInvitation(): string | null {
  try {
    const parsed = ownerInvitationTokenSchema.safeParse(storage()?.getItem(STORAGE_KEY));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

const subscribeNothing = () => () => undefined;

export function useHasPendingOwnerInvitation(): boolean {
  return useSyncExternalStore(subscribeNothing, () => readOwnerInvitation() !== null, () => false);
}
