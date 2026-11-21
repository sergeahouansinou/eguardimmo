'use client';

import { useState } from 'react';
import { Alert, Button, Dialog, DialogClose, DialogContent, Select, Textarea } from '@eguardimmo/ui';
import { staffErrorMessage } from '../api/errors';
import type { StaffProof } from '../context';
import { MAX_MUTE_DAYS, MIN_REASON_LENGTH } from '../model';
import { useStaffRestrict } from '../queries';

const DURATIONS = [1, 3, 7, 14, MAX_MUTE_DAYS] as const;

export interface MuteDialogProps {
  threadId: string;
  partyLabel: string;
  open: boolean;
  proof: StaffProof;
  onClose: () => void;
}

export function MuteDialog({ threadId, partyLabel, open, proof, onClose }: MuteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent
        title="Restreindre l’envoi"
        description={`${partyLabel} pourra relire cette conversation, sans y répondre ni en ouvrir de nouvelle, jusqu’à la fin de la restriction. Cette action exige une double authentification récente.`}
        className="max-w-[480px]"
      >
        {open ? <MuteForm threadId={threadId} proof={proof} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function MuteForm({ threadId, proof, onClose }: Pick<MuteDialogProps, 'threadId' | 'proof' | 'onClose'>) {
  const restrict = useStaffRestrict(threadId);
  const [days, setDays] = useState(String(MAX_MUTE_DAYS));
  const [reason, setReason] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [failure, setFailure] = useState<string | null>(null);

  const run = () => {
    restrict.mutate(
      { days: Number(days), reason: reason.trim() },
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
    if (reason.trim().length < MIN_REASON_LENGTH) {
      setFieldError('Indiquez le motif de la restriction (5 caractères au moins).');
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
      <Select
        label="Durée"
        placeholder="Choisir une durée"
        value={days}
        onValueChange={setDays}
        options={DURATIONS.map((value) => ({ value: String(value), label: value === 1 ? '1 jour' : `${String(value)} jours` }))}
      />
      <Textarea
        data-autofocus
        placeholder="Ex. Messages répétés malgré plusieurs rappels"
        label="Motif *"
        hint="Le motif reste dans le dossier de l’organisation."
        rows={3}
        maxLength={500}
        value={reason}
        onChange={(event) => {
          setReason(event.target.value);
          setFieldError(undefined);
        }}
        {...(fieldError ? { error: fieldError } : {})}
      />
      {failure ? <Alert tone="danger" title="Restriction impossible">{failure}</Alert> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <DialogClose asChild>
          <Button variant="ghost">Annuler</Button>
        </DialogClose>
        <Button type="submit" loading={restrict.isPending}>
          Restreindre
        </Button>
      </div>
    </form>
  );
}
