'use client';

import { Alert, IconButton } from '@eguardimmo/ui';
import { X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { create } from 'zustand';

export interface Flash {
  tone: 'success' | 'info' | 'warning';
  title: string;
  detail?: string;
  path: string;
}

interface FlashStore {
  flash: Flash | null;
  show: (flash: Flash) => void;
  dismiss: () => void;
}

export const useFlash = create<FlashStore>((set) => ({
  flash: null,
  show: (flash) => { set({ flash }); },
  dismiss: () => { set({ flash: null }); },
}));

export function FlashRegion() {
  const { flash, dismiss } = useFlash();
  const pathname = usePathname();
  useEffect(() => {
    if (flash && pathname !== flash.path) dismiss();
  }, [flash, pathname, dismiss]);
  if (!flash) return null;
  if (pathname !== flash.path) return null;
  return (
    <div className="relative print:hidden">
      <Alert tone={flash.tone} title={flash.title} className="pr-10">
        {flash.detail}
      </Alert>
      <IconButton label="Fermer le message" icon={X} className="absolute top-1.5 right-1.5" onClick={dismiss} />
    </div>
  );
}
