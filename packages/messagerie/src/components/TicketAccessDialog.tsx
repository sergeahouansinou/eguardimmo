'use client';

import { KeyRound } from 'lucide-react';
import { useState } from 'react';
import { Alert, Button, Dialog, DialogClose, DialogContent, DialogTrigger, Icon, Textarea } from '@eguardimmo/ui';
import { accessReasonSchema } from '../data/inputs';
import { useRequestTicketAccess } from '../data/queries';
import { errorMessage } from '../lib/errors';

export function TicketAccessDialog({ ticketId, onGranted }: { ticketId: string; onGranted: () => void }) {
  const request = useRequestTicketAccess(ticketId);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [failure, setFailure] = useState<string | null>(null);

  const reset = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setReason('');
      setError(undefined);
      setFailure(null);
    }
  };

  const submit = () => {
    const parsed = accessReasonSchema.safeParse({ reason });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message);
      return;
    }
    setError(undefined);
    setFailure(null);
    request.mutate(parsed.data.reason, {
      onSuccess: () => {
        reset(false);
        onGranted();
      },
      onError: (cause) => { setFailure(errorMessage(cause)); },
    });
  };

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          <Icon icon={KeyRound} />
          Demander un accès justifié
        </Button>
      </DialogTrigger>
      <DialogContent
        title="Accès justifié"
        description="L’accès aux données de l’organisation est limité à 60 minutes et journalisé avec votre motif."
      >
        <form
          noValidate
          className="flex flex-col gap-3 px-4 pt-3 pb-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <Textarea
            data-autofocus
            label="Motif de l’accès"
            placeholder="Ex. Vérifier l’erreur d’envoi signalée dans le ticket"
            rows={4}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              setError(undefined);
            }}
            {...(error ? { error } : {})}
          />
          {failure ? <Alert tone="danger" title="Demande impossible">{failure}</Alert> : null}
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="secondary">Annuler</Button>
            </DialogClose>
            <Button type="submit" loading={request.isPending}>
              Ouvrir l’accès
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
