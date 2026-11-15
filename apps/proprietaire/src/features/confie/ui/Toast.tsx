"use client";

import { Alert } from "@eguardimmo/ui";
import type { AlertTone } from "@eguardimmo/ui";
import { createContext, use, useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

interface ToastItem {
  id: number;
  tone: AlertTone;
  message: string;
}

interface ToastApi {
  notify: (message: string, tone?: AlertTone) => void;
}

const ToastContext = createContext<ToastApi | null>(null);
const DURATION_MS = 6000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const active = timers.current;
    return () => {
      for (const timer of active) clearTimeout(timer);
    };
  }, []);

  const notify = useCallback((message: string, tone: AlertTone = "success") => {
    counter.current += 1;
    const id = counter.current;
    setItems((current) => [...current, { id, tone, message }]);
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      setItems((current) => current.filter((item) => item.id !== id));
    }, DURATION_MS);
    timers.current.add(timer);
  }, []);

  return (
    <ToastContext value={{ notify }}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-20 z-50 flex flex-col items-end gap-2 md:bottom-4">
        {items.map((item) => (
          <Alert key={item.id} tone={item.tone} className="pointer-events-auto w-full max-w-md bg-surface">
            {item.message}
          </Alert>
        ))}
      </div>
    </ToastContext>
  );
}

export function useToast(): ToastApi {
  const api = use(ToastContext);
  if (!api) throw new Error("ToastProvider manquant autour de l'espace propriétaire mandant.");
  return api;
}
