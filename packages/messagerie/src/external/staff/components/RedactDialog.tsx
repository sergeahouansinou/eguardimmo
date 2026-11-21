'use client';

import { useState } from 'react';
import { Alert, Button, Dialog, DialogClose, DialogContent, Textarea } from '@eguardimmo/ui';
import { REDACTION_WINDOW_MS } from '../../model';
import { staffErrorMessage } from '../api/errors';
import type { StaffProof } from '../context';
import { MIN_REASON_LENGTH } from '../model';
import type { StaffMessage } from '../model';
import { useStaffRedact } from '../queries';

export interface RedactDialogProps {
  threadId: string;
  message: StaffMessage | null;
  proof: StaffProof;
  now: number;
  onClose: () => void;
}

export function reasonRequired(message: StaffMessage, now: number): boolean {
  return !(message.mine && now - new Date(message.sentAt).getTime() <= REDACTION_WINDOW_MS);
}

export function RedactDialog({ threadId, message, proof, now, onClose }: RedactDialogProps) {
  return (
    <Dialog open={message !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        title="Retirer ce message ?"
        description="Le texte est remplacé par « Message retiré » et les pièces jointes sont supprimées. Cette action est définitive. Si le message n’est pas le vôtre, son auteur en est informé, sans le motif."
        className="max-w-[480px]"
      >
        {message === null ? null : <RedactForm threadId={threadId} message={message} proof={proof} now={now} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function RedactForm({ threadId, message, proof, now, onClose }: Omit<RedactDialogProps, 'message'> & { message: StaffMessage }) {
  const redact = useStaffRedact(threadId);
  const required = reasonRequired(message, now);
  const [reason, setReason] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [failure, setFailure] = useState<string | null>(null);

  const run = () => {
    redact.mutate(
      { message, reason: reason.trim() === '' ? null : reason.trim() },
      {
        onSuccess: onClose,
        onError: (error) => {
          if (proof.intercept(error, run)) return;
          setFailure(staffErrorMessage(error));
        },
      },
    );
  };

  const submit = () => {
    if (required && reason.trim().length < MIN_REASON_LENGTH) {
      setFieldError('Indiquez le motif du retrait (5 caractères au moins).');
      return;
    }
    setFieldError(undefined);
    setFailure(null);
    run();
  };

  return (
    <form
      noValidate
      className="flex flex-col gap-3 px-4 pt-3 pb-4"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        submit();
      }}
    >
      <Textarea
        data-autofocus
        placeholder="Ex. Pièce d’identité envoyée par erreur"
        label={required ? 'Motif du retrait *' : 'Motif du retrait (facultatif)'}
        hint="Le motif reste dans le dossier de l’organisation. N’y recopiez pas le contenu du message."
        rows={3}
        maxLength={500}
        value={reason}
        onChange={(event) => {
          setReason(event.target.value);
          setFieldError(undefined);
        }}
        {...(fieldError ? { error: fieldError } : {})}
      />
      {failure ? <Alert tone="danger" title="Retrait impossible">{failure}</Alert> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <DialogClose asChild>
          <Button variant="ghost">Annuler</Button>
        </DialogClose>
        <Button type="submit" variant="danger" loading={redact.isPending}>
          Retirer le message
        </Button>
      </div>
    </form>
  );
}
