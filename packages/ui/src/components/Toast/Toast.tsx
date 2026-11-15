'use client';

import { X } from 'lucide-react';
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import { IconButton } from '../IconButton/IconButton';
import { Alert } from '../Alert/Alert';
import type { AlertTone } from '../Alert/Alert';

export interface ToastOptions {
  tone?: AlertTone;
  title: string;
  description?: string;
}

interface ToastItem extends ToastOptions {
  id: number;
}

interface ToastContextValue {
  show: (toast: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DISMISS_AFTER_MS = 6000;

export interface ToastProviderProps {
  children: ReactNode;
  durationMs?: number;
  className?: string;
}

export function ToastProvider({ children, durationMs = DISMISS_AFTER_MS, className }: ToastProviderProps) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const show = useCallback(
    (toast: ToastOptions) => {
      nextId.current += 1;
      const id = nextId.current;
      setItems((current) => [...current.slice(-3), { ...toast, id }]);
      timers.current.set(
        id,
        setTimeout(() => { dismiss(id); }, durationMs),
      );
    },
    [dismiss, durationMs],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => { clearTimeout(timer); });
      pending.clear();
    };
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className={cx('pointer-events-none fixed right-4 bottom-4 z-[60] flex w-[min(380px,calc(100vw-32px))] flex-col gap-2', className)}
      >
        {items.map((item) => (
          <div key={item.id} className="pointer-events-auto relative">
            <Alert tone={item.tone ?? 'success'} title={item.title} className="pr-10 shadow-md">
              {item.description}
            </Alert>
            <IconButton
              label="Fermer la notification"
              icon={X}
              size="xs"
              className="absolute top-2 right-2"
              onClick={() => { dismiss(item.id); }}
            />
          </div>
        ))}
      </div>
    </ToastContext>
  );
}

export function useToast(): ToastContextValue {
  const context = use(ToastContext);
  if (!context) throw new Error('useToast doit être utilisé dans un ToastProvider.');
  return context;
}
