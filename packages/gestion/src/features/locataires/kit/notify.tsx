'use client';

import { useToast } from '@eguardimmo/ui';
import type { ToastOptions } from '@eguardimmo/ui';
import { useEffect } from 'react';

let pending: ToastOptions | null = null;

export function noticeAfterNavigation(notice: ToastOptions): void {
  pending = notice;
}

export function PendingNotice() {
  const toast = useToast();
  useEffect(() => {
    if (!pending) return;
    const notice = pending;
    pending = null;
    toast.show(notice);
  }, [toast]);
  return null;
}

export function useNotify(): (notice: ToastOptions) => void {
  return useToast().show;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Une erreur est survenue. Réessayez.';
}
