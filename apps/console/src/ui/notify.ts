'use client';

import { useToast } from '@eguardimmo/ui';
import { useMemo } from 'react';

export interface Notify {
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
}

export function useNotify(): Notify {
  const { show } = useToast();
  return useMemo(
    () => ({
      success: (title, description) => { show({ tone: 'success', title, description }); },
      error: (title, description) => { show({ tone: 'danger', title, description }); },
    }),
    [show],
  );
}
