'use client';

import { useRef } from 'react';

export function newKey(): string {
  return `ui-${globalThis.crypto.randomUUID()}`;
}

export function useAttemptKey(): (signature: string) => string {
  const attempt = useRef<{ signature: string; key: string } | null>(null);
  return (signature) => {
    if (attempt.current?.signature !== signature) attempt.current = { signature, key: newKey() };
    return attempt.current.key;
  };
}
