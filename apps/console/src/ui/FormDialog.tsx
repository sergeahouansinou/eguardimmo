'use client';

import type { ReactNode, SubmitEvent } from 'react';
import { Alert, Button, Dialog, DialogClose, DialogContent } from '@eguardimmo/ui';

export interface FormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  submitLabel: string;
  tone?: 'primary' | 'danger';
  pending: boolean;
  failure?: string | null;
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
  children: ReactNode;
}

export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  tone = 'primary',
  pending,
  failure,
  onSubmit,
  children,
}: FormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title} description={description}>
        <form
          noValidate
          onSubmit={(event) => {
            event.stopPropagation();
            onSubmit(event);
          }}
          className="flex flex-col gap-3 px-4 pt-3 pb-4">
          {children}
          {failure ? <Alert tone="danger">{failure}</Alert> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <DialogClose asChild>
              <Button variant="secondary">Annuler</Button>
            </DialogClose>
            <Button type="submit" variant={tone === 'danger' ? 'danger' : 'primary'} loading={pending}>
              {submitLabel}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
