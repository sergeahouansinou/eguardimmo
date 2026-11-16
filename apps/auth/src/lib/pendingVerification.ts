"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "eguardimmo.auth.pending-verification-email";

function storage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function rememberVerificationEmail(email: string): void {
  try {
    storage()?.setItem(STORAGE_KEY, email.trim());
  } catch {
    return;
  }
}

export function forgetVerificationEmail(): void {
  try {
    storage()?.removeItem(STORAGE_KEY);
  } catch {
    return;
  }
}

function readVerificationEmail(): string | null {
  try {
    const value = storage()?.getItem(STORAGE_KEY) ?? null;
    return value !== null && value !== "" ? value : null;
  } catch {
    return null;
  }
}

const subscribeNothing = () => () => undefined;

export function useRememberedVerificationEmail(): string | null {
  return useSyncExternalStore(subscribeNothing, readVerificationEmail, () => null);
}
