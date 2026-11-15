'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { Alert, Button, Dialog, DialogClose, DialogContent, TextField } from '@eguardimmo/ui';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  tone?: 'primary' | 'danger';
  onConfirm: () => Promise<void>;
  requiredPhrase?: string;
  phraseLabel?: string;
  children?: ReactNode;
}

export function ConfirmDialog({ open, onOpenChange, ...props }: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={props.title} description={props.description}>
        <ConfirmBody {...props} onClose={() => { onOpenChange(false); }} />
      </DialogContent>
    </Dialog>
  );
}

type ConfirmBodyProps = Omit<ConfirmDialogProps, 'open' | 'onOpenChange' | 'title' | 'description'> & {
  onClose: () => void;
};

function ConfirmBody({
  confirmLabel,
  tone = 'primary',
  onConfirm,
  onClose,
  requiredPhrase,
  phraseLabel = 'Confirmation',
  children,
}: ConfirmBodyProps) {
  const [typed, setTyped] = useState('');
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const phraseOk = requiredPhrase === undefined || typed === requiredPhrase;

  const submit = async () => {
    setPending(true);
    setFailure(null);
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'L’action a échoué. Réessayez.');
    } finally {
      setPending(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-3 px-4 pt-3 pb-4"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (phraseOk) void submit();
      }}
    >
      {children}
      {requiredPhrase === undefined ? null : (
        <TextField
          label={phraseLabel}
          placeholder={requiredPhrase}
          value={typed}
          onChange={(event) => { setTyped(event.target.value); }}
          autoComplete="off"
          spellCheck={false}
          hint={`Saisissez exactement « ${requiredPhrase} » pour confirmer.`}
          data-autofocus
        />
      )}
      {failure ? <Alert tone="danger">{failure}</Alert> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <DialogClose asChild>
          <Button variant="secondary">Annuler</Button>
        </DialogClose>
        <Button type="submit" variant={tone === 'danger' ? 'danger' : 'primary'} loading={pending} disabled={!phraseOk}>
          {confirmLabel}
        </Button>
      </div>
    </form>
  );
}
