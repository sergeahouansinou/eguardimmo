'use client';

import { X } from 'lucide-react';
import { useEffect, useSyncExternalStore } from 'react';
import { Alert, IconButton } from '@eguardimmo/ui';

const DURATION_MS = 8000;

let message: string | null = null;
const listeners = new Set<() => void>();

function emit(next: string | null) {
  message = next;
  listeners.forEach((listener) => { listener(); });
}

export function pushFlash(text: string): void {
  emit(text);
}

export function dismissFlash(): void {
  emit(null);
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

export function FlashAlert() {
  const text = useSyncExternalStore(subscribe, () => message, () => null);
  useEffect(() => {
    if (text === null) return;
    const timer = setTimeout(dismissFlash, DURATION_MS);
    return () => { clearTimeout(timer); };
  }, [text]);
  if (text === null) return null;
  return (
    <Alert tone="success" className="items-center">
      <div className="flex items-center justify-between gap-2">
        <span>{text}</span>
        <IconButton label="Fermer le message" icon={X} size="xs" onClick={dismissFlash} />
      </div>
    </Alert>
  );
}
