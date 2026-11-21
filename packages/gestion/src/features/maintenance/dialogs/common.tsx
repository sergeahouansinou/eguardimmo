'use client';

import { Alert, Button, Dialog, DialogClose, DialogContent } from '@eguardimmo/ui';
import type { ToastOptions } from '@eguardimmo/ui';
import { useState } from 'react';
import type { SyntheticEvent, ReactNode } from 'react';
import { MaintenanceApiError } from '../api/maintenanceErrors';
import { errorMessage, useNotify } from '../../locataires/kit';
import { useRefreshOnStale } from '../hooks';
import type { InterventionDetail } from '../model';

export interface Submission {
  failure: string | null;
  pending: boolean;
  fail: (message: string) => void;
  run: (action: () => Promise<unknown>, success: ToastOptions | null, onDone: () => void) => Promise<void>;
}

export function useSubmission(): Submission {
  const notify = useNotify();
  const refresh = useRefreshOnStale();
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const run: Submission['run'] = async (action, success, onDone) => {
    setFailure(null);
    setPending(true);
    try {
      await action();
      if (success) notify(success);
      onDone();
    } catch (error) {
      if (error instanceof MaintenanceApiError && error.kind === 'stale') {
        notify({ tone: 'warning', title: 'Intervention modifiée entre-temps', description: 'Elle a été rechargée : vérifiez son état, puis recommencez.' });
        void refresh();
        onDone();
      } else {
        setFailure(errorMessage(error));
      }
    } finally {
      setPending(false);
    }
  };
  return { failure, pending, fail: setFailure, run };
}

export function FormDialog({
  open,
  onClose,
  title,
  description,
  submitLabel,
  submission,
  onSubmit,
  wide = false,
  tone = 'primary',
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  submitLabel: string;
  submission: Submission;
  onSubmit: () => void;
  wide?: boolean;
  tone?: 'primary' | 'danger';
  children: ReactNode;
}) {
  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onSubmit();
  };
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent title={title} description={description} className={wide ? 'max-w-[720px]' : 'max-w-[480px]'}>
        <form noValidate className="flex flex-col gap-3 p-4" onSubmit={submit}>
          {children}
          {submission.failure ? <Alert tone="danger" title="Action non enregistrée">{submission.failure}</Alert> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <DialogClose asChild>
              <Button variant="ghost">Retour</Button>
            </DialogClose>
            <Button type="submit" variant={tone} loading={submission.pending}>{submitLabel}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export interface DialogProps {
  intervention: InterventionDetail;
  onClose: () => void;
}

export const stableKey = (attempt: { current: { signature: string; key: string } | null }, signature: string): string => {
  if (attempt.current?.signature !== signature) attempt.current = { signature, key: globalThis.crypto.randomUUID() };
  return attempt.current.key;
};
