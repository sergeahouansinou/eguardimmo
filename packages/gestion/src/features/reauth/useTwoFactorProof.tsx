'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { TwoFactorProofDialog } from './TwoFactorProofDialog';
import { isReauthenticationRequired } from './proof';
import type { ConfirmProof } from './proof';

export interface TwoFactorProof {
  dialog: ReactNode;
  intercept: (error: unknown, replay: () => void, abandon?: () => void) => boolean;
}

export function useTwoFactorProof(confirm: ConfirmProof): TwoFactorProof {
  const [pending, setPending] = useState<{ replay: () => void; abandon: (() => void) | undefined } | null>(null);

  const intercept = (error: unknown, replay: () => void, abandon?: () => void): boolean => {
    if (!isReauthenticationRequired(error)) return false;
    setPending({ replay, abandon });
    return true;
  };

  const dialog = (
    <TwoFactorProofDialog
      open={pending !== null}
      confirm={confirm}
      onCancel={() => {
        const current = pending;
        setPending(null);
        current?.abandon?.();
      }}
      onConfirmed={() => {
        const current = pending;
        setPending(null);
        current?.replay();
      }}
    />
  );

  return { dialog, intercept };
}
