'use client';

import { Button, Dialog, DialogClose, DialogContent, Textarea } from '@eguardimmo/ui';
import { useState } from 'react';

export interface ReasonDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  placeholder: string;
  loading: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

export function ReasonDialog({ open, title, description, confirmLabel, placeholder, loading, onConfirm, onClose }: ReasonDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent title={title} description={description} className="max-w-[480px]">
        {open ? <ReasonForm confirmLabel={confirmLabel} placeholder={placeholder} loading={loading} onConfirm={onConfirm} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function ReasonForm({ confirmLabel, placeholder, loading, onConfirm }: Pick<ReasonDialogProps, 'confirmLabel' | 'placeholder' | 'loading' | 'onConfirm'>) {
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const trimmed = reason.trim();
  const error = touched && (trimmed.length < 2 || trimmed.length > 255) ? 'Indiquez un motif de 2 à 255 caractères.' : undefined;

  const submit = () => {
    setTouched(true);
    if (trimmed.length >= 2 && trimmed.length <= 255) onConfirm(trimmed);
  };

  return (
    <div className="flex flex-col gap-3 p-4">
      <Textarea label="Motif *" placeholder={placeholder} rows={3} value={reason} error={error} onChange={(event) => { setReason(event.target.value); }} onBlur={() => { setTouched(true); }} />
      <div className="flex flex-wrap justify-end gap-2">
        <DialogClose asChild>
          <Button variant="ghost">Retour</Button>
        </DialogClose>
        <Button variant="danger" loading={loading} onClick={submit}>{confirmLabel}</Button>
      </div>
    </div>
  );
}
