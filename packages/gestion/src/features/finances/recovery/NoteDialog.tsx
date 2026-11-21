'use client';

import { Button, Dialog, DialogClose, DialogContent, Textarea } from '@eguardimmo/ui';
import { useState } from 'react';

export interface NoteDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  placeholder: string;
  tone?: 'default' | 'danger';
  loading: boolean;
  onConfirm: (note: string) => void;
  onClose: () => void;
}

const MAX = 255;

export function NoteDialog({ open, title, description, confirmLabel, placeholder, tone = 'default', loading, onConfirm, onClose }: NoteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent title={title} description={description} className="max-w-[480px]">
        {open ? <NoteForm confirmLabel={confirmLabel} placeholder={placeholder} tone={tone} loading={loading} onConfirm={onConfirm} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function NoteForm({ confirmLabel, placeholder, tone, loading, onConfirm }: Pick<NoteDialogProps, 'confirmLabel' | 'placeholder' | 'tone' | 'loading' | 'onConfirm'>) {
  const [note, setNote] = useState('');
  const trimmed = note.trim();
  const error = trimmed.length > MAX ? `Le motif ne dépasse pas ${String(MAX)} caractères.` : undefined;
  return (
    <div className="flex flex-col gap-3 p-4">
      <Textarea label="Motif (facultatif)" placeholder={placeholder} rows={3} value={note} error={error} onChange={(event) => { setNote(event.target.value); }} />
      <div className="flex flex-wrap justify-end gap-2">
        <DialogClose asChild>
          <Button variant="ghost">Retour</Button>
        </DialogClose>
        <Button variant={tone === 'danger' ? 'danger' : 'primary'} loading={loading} disabled={error !== undefined} onClick={() => { onConfirm(trimmed); }}>{confirmLabel}</Button>
      </div>
    </div>
  );
}
