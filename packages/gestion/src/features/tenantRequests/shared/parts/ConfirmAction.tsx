'use client';

import { ConfirmDialog } from '@eguardimmo/ui';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { ActionError } from './ActionError';

export interface ConfirmActionProps {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  failureTitle: string;
  tone?: 'default' | 'danger';
  run: () => Promise<void>;
  onClose: () => void;
}

export function ConfirmAction({ open, title, description, confirmLabel, failureTitle, tone = 'default', run, onClose }: ConfirmActionProps) {
  const [failure, setFailure] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  const close = () => {
    setFailure(null);
    onClose();
  };

  const confirm = async () => {
    setLoading(true);
    setFailure(null);
    try {
      await run();
      onClose();
    } catch (error) {
      setFailure(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => { if (!next) close(); }}
      title={title}
      description={
        <span className="flex flex-col gap-2">
          <span>{description}</span>
          {failure === null ? null : <ActionError title={failureTitle} error={failure} />}
        </span>
      }
      confirmLabel={confirmLabel}
      tone={tone}
      loading={loading}
      onConfirm={() => { void confirm(); }}
    />
  );
}
