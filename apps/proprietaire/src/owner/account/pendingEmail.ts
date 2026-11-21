import { useMemo, useSyncExternalStore } from "react";
import { z } from "zod";

export const PENDING_EMAIL_KEY = "eguardimmo.proprietaire.pendingEmailChange";
const pendingSchema = z.object({ email: z.email(), expiresAt: z.number().int() });

export type PendingEmail = z.infer<typeof pendingSchema>;

const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function parsePendingEmail(raw: string): PendingEmail | null {
  try {
    const parsed = pendingSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function readRaw(now: number = Date.now()): string | null {
  try {
    const raw = globalThis.sessionStorage.getItem(PENDING_EMAIL_KEY);
    if (raw === null) return null;
    const pending = parsePendingEmail(raw);
    return pending !== null && pending.expiresAt > now ? raw : null;
  } catch {
    return null;
  }
}

export function rememberPendingEmail(email: string, minutes: number, now: number = Date.now()): void {
  try {
    globalThis.sessionStorage.setItem(PENDING_EMAIL_KEY, JSON.stringify({ email, expiresAt: now + minutes * 60_000 }));
  } catch {
    return;
  }
  notify();
}

export function forgetPendingEmail(): void {
  try {
    globalThis.sessionStorage.removeItem(PENDING_EMAIL_KEY);
  } catch {
    return;
  }
  notify();
}

export function usePendingEmail(): PendingEmail | null | undefined {
  const raw = useSyncExternalStore(subscribe, readRaw, () => undefined);
  return useMemo(() => (raw === undefined ? undefined : raw === null ? null : parsePendingEmail(raw)), [raw]);
}
