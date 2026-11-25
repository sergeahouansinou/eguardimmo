'use client';

import { TextField } from '@eguardimmo/ui';
import { useState } from 'react';
import { FormDialog } from '@/ui/FormDialog';
import { isSafeLink } from '../html/formattingLoss';

export interface LinkDialogProps {
  initial: string;
  onApply: (url: string) => void;
  onClose: () => void;
}

export function LinkDialog({ initial, onApply, onClose }: LinkDialogProps) {
  const [url, setUrl] = useState(initial);
  const [error, setError] = useState<string | undefined>(undefined);
  return (
    <FormDialog
      open
      onOpenChange={(open) => { if (!open) onClose(); }}
      title="Lien"
      description="Laissez le champ vide pour retirer le lien."
      submitLabel="Appliquer"
      pending={false}
      onSubmit={(event) => {
        event.preventDefault();
        const value = url.trim();
        if (value !== '' && !isSafeLink(value)) {
          setError('Saisissez une adresse commençant par https://, mailto: ou tel:');
          return;
        }
        onApply(value);
        onClose();
      }}
    >
      <TextField
        label="Adresse du lien"
        placeholder="https://exemple.fr/page"
        inputMode="url"
        autoComplete="off"
        value={url}
        error={error}
        onChange={(event) => { setUrl(event.target.value); }}
        data-autofocus
      />
    </FormDialog>
  );
}
