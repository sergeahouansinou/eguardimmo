'use client';

import { Alert, Button, Dialog, DialogClose, DialogContent, useToast } from '@eguardimmo/ui';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { usePlatformMutation } from '@/platform/context';
import type { PlatformApi } from '@/platform/api';
import { problemText } from '@/platform/errors';

export interface ActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  tone?: 'primary' | 'danger';
  successTitle: string;
  run: (api: PlatformApi) => Promise<unknown>;
  beforeSubmit?: () => boolean;
  children?: ReactNode;
}

function Body({ onOpenChange, confirmLabel, tone = 'primary', successTitle, run, beforeSubmit, children }: Omit<ActionDialogProps, 'open' | 'title' | 'description'>) {
  const { show } = useToast();
  const [failure, setFailure] = useState<string | null>(null);
  const mutation = usePlatformMutation((api) => run(api));

  const confirm = () => {
    setFailure(null);
    if (beforeSubmit && !beforeSubmit()) return;
    mutation.mutate(undefined, {
      onSuccess: () => {
        show({ tone: 'success', title: successTitle });
        onOpenChange(false);
      },
      onError: (error) => { setFailure(problemText(error)); },
    });
  };

  return (
    <div className="flex flex-col gap-3 px-4 pt-3 pb-4">
      {children}
      {failure ? <Alert tone="danger">{failure}</Alert> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <DialogClose asChild>
          <Button type="button" variant="secondary" data-autofocus>
            Annuler
          </Button>
        </DialogClose>
        <Button type="button" variant={tone === 'danger' ? 'danger' : 'primary'} loading={mutation.isPending} onClick={confirm}>
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
}

export function ActionDialog({ open, onOpenChange, title, description, ...body }: ActionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title} description={description}>
        <Body {...body} onOpenChange={onOpenChange} />
      </DialogContent>
    </Dialog>
  );
}
