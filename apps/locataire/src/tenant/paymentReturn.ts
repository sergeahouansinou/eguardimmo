import { useSyncExternalStore } from 'react';
import { isUuid } from './ids';

const STORAGE_KEY = 'eguardimmo.locataire.pendingPayment';
const PARAMS = ['paiement', 'payment'] as const;

const listeners = new Set<() => void>();
const notify = () => {
  for (const listener of listeners) listener();
};

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function rememberPayment(id: string): void {
  try {
    globalThis.sessionStorage.setItem(STORAGE_KEY, id);
  } catch {
    return;
  }
  notify();
}

export function recallPayment(): string | null {
  try {
    const stored = globalThis.sessionStorage.getItem(STORAGE_KEY);
    return isUuid(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function forgetPayment(): void {
  try {
    globalThis.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    return;
  }
  notify();
}

export function paymentIdFromParams(params: URLSearchParams): string | null {
  for (const name of PARAMS) {
    const value = params.get(name);
    if (isUuid(value)) return value;
  }
  return null;
}

export function useRememberedPayment(): string | null | undefined {
  return useSyncExternalStore(subscribe, recallPayment, () => undefined);
}
