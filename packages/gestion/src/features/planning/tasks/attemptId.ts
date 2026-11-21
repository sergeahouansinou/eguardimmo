'use client';

import { useRef } from 'react';

export function useAttemptId(): (signature: string) => string {
  const attempt = useRef<{ signature: string; id: string } | null>(null);
  return (signature) => {
    if (attempt.current?.signature !== signature) attempt.current = { signature, id: globalThis.crypto.randomUUID() };
    return attempt.current.id;
  };
}
