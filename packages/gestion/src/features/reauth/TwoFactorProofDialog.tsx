'use client';

import { Alert, Button, Dialog, DialogClose, DialogContent, TextField } from '@eguardimmo/ui';
import { useState } from 'react';
import { errorMessage } from '../locataires/kit';
import { waitText } from './proof';
import type { ConfirmProof } from './proof';

export interface TwoFactorProofDialogProps {
  open: boolean;
  confirm: ConfirmProof;
  onConfirmed: () => void;
  onCancel: () => void;
}

export function TwoFactorProofDialog({ open, confirm, onConfirmed, onCancel }: TwoFactorProofDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onCancel(); }}>
      <DialogContent
        title="Confirmez votre identité"
        description="Cette action exige un code de double authentification de moins de 10 minutes. Saisissez le code de votre application d’authentification, ou un code de secours."
        className="max-w-[440px]"
      >
        {open ? <ProofForm confirm={confirm} onConfirmed={onConfirmed} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function ProofForm({ confirm, onConfirmed }: { confirm: ConfirmProof; onConfirmed: () => void }) {
  const [entry, setEntry] = useState('');
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);

  const submit = async () => {
    setFailure(null);
    setFieldError(undefined);
    if (entry.trim() === '') {
      setFieldError('Saisissez le code à 6 chiffres, ou un code de secours.');
      return;
    }
    setLoading(true);
    try {
      const outcome = await confirm(entry);
      if (outcome.status === 'ok') {
        onConfirmed();
        return;
      }
      if (outcome.status === 'invalid') setFieldError('Ce code est incorrect ou expiré. Vérifiez-le puis réessayez.');
      else setFailure(`Trop d’essais en peu de temps. Réessayez ${waitText(outcome.retryAfterSeconds)}.`);
    } catch (error) {
      setFailure(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      noValidate
      className="flex flex-col gap-3 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void submit();
      }}
    >
      <TextField
        label="Code de double authentification *"
        placeholder="123456"
        autoComplete="one-time-code"
        autoCapitalize="none"
        spellCheck={false}
        value={entry}
        error={fieldError}
        onChange={(event) => { setEntry(event.target.value); }}
        data-autofocus
      />
      {failure === null ? null : <Alert tone="danger" title="Confirmation impossible">{failure}</Alert>}
      <p className="text-caption text-fg-subtle">Votre action est rejouée dès que le code est accepté. Rien n’a été enregistré avant.</p>
      <div className="flex flex-wrap justify-end gap-2">
        <DialogClose asChild>
          <Button variant="ghost">Annuler</Button>
        </DialogClose>
        <Button type="submit" loading={loading}>Confirmer</Button>
      </div>
    </form>
  );
}
