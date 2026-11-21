import { useRef } from 'react';

export function newClientId(): string {
  return globalThis.crypto.randomUUID();
}

export function useAttemptKey(): (signature: string) => string {
  const attempt = useRef<{ signature: string; key: string } | null>(null);
  return (signature) => {
    if (attempt.current?.signature !== signature) attempt.current = { signature, key: newClientId() };
    return attempt.current.key;
  };
}
