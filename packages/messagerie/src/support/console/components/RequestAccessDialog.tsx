'use client';

import { useState } from 'react';
import { Alert, Button, Checkbox, Dialog, DialogClose, DialogContent, Textarea, TextField } from '@eguardimmo/ui';
import { scopeHint } from '../../access/copy';
import { ACCESS_SCOPES, DEFAULT_ACCESS_HOURS, MAX_ACCESS_HOURS, MIN_ACCESS_HOURS } from '../../access/model';
import type { AccessScope } from '../../access/model';
import { consoleErrorMessage } from '../api/errors';
import { scopeReadable } from '../copy';
import { REASON_MAX, REASON_MIN } from '../model';
import { useRequestAccess } from '../queries';

const NOT_READABLE: readonly AccessScope[] = ['records', 'documents'];

export interface AccessDialogProps {
  ticketId: string;
  organizationName: string | null;
  open: boolean;
  onClose: () => void;
}

export function RequestAccessDialog({ ticketId, organizationName, open, onClose }: AccessDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent
        title="Demander l’accès aux données de l’organisation"
        description={`${organizationName ?? 'L’organisation'} reçoit votre demande et décide : un administrateur peut l’accepter, la réduire ou la refuser. L’accès est en lecture seule.`}
        className="max-w-[520px]"
      >
        {open ? <RequestForm ticketId={ticketId} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function RequestForm({ ticketId, onClose }: { ticketId: string; onClose: () => void }) {
  const request = useRequestAccess(ticketId);
  const [reason, setReason] = useState('');
  const [hours, setHours] = useState(String(DEFAULT_ACCESS_HOURS));
  const [scopes, setScopes] = useState<AccessScope[]>(['settings', 'team']);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [failure, setFailure] = useState<string | null>(null);
  const toggle = (scope: AccessScope, checked: boolean) => {
    setScopes(ACCESS_SCOPES.filter((candidate) => (candidate === scope ? checked : scopes.includes(candidate))));
    setFieldError(undefined);
  };
  const submit = () => {
    const trimmed = reason.trim();
    const value = Number(hours);
    if (trimmed.length < REASON_MIN || trimmed.length > REASON_MAX) {
      setFieldError(`Le motif doit faire de ${String(REASON_MIN)} à ${String(REASON_MAX)} caractères.`);
      return;
    }
    if (scopes.length === 0) {
      setFieldError('Choisissez au moins un périmètre.');
      return;
    }
    if (!Number.isInteger(value) || value < MIN_ACCESS_HOURS || value > MAX_ACCESS_HOURS) {
      setFieldError(`Indiquez une durée entière de ${String(MIN_ACCESS_HOURS)} à ${String(MAX_ACCESS_HOURS)} heures.`);
      return;
    }
    setFieldError(undefined);
    setFailure(null);
    request.mutate({ reason: trimmed, scopes, durationHours: value }, { onSuccess: onClose, onError: (error) => { setFailure(consoleErrorMessage(error)); } });
  };
  return (
    <form
      noValidate
      className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto px-4 pt-3 pb-4"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        submit();
      }}
    >
      <Textarea
        data-autofocus
        label="Motif de la demande *"
        placeholder="Ex. Diagnostiquer l’erreur d’affichage des rôles signalée dans la demande"
        hint={`${String(REASON_MIN)} à ${String(REASON_MAX)} caractères. L’organisation lit ce motif avant de décider.`}
        rows={3}
        maxLength={REASON_MAX}
        value={reason}
        onChange={(event) => {
          setReason(event.target.value);
          setFieldError(undefined);
        }}
      />
      <fieldset className="flex min-w-0 flex-col gap-2">
        <legend className="text-body font-medium text-fg">Périmètre demandé</legend>
        {ACCESS_SCOPES.map((scope) => (
          <div key={scope} className="flex min-w-0 flex-col gap-0.5">
            <Checkbox label={scopeReadable[scope]} checked={scopes.includes(scope)} onChange={(event) => { toggle(scope, event.target.checked); }} />
            <span className="pl-6 text-caption text-fg-muted">
              {scopeHint[scope]}
              {NOT_READABLE.includes(scope) ? ' Aucune lecture de ce périmètre n’est encore disponible dans la console.' : ''}
            </span>
          </div>
        ))}
      </fieldset>
      <TextField
        type="number"
        inputMode="numeric"
        min={MIN_ACCESS_HOURS}
        max={MAX_ACCESS_HOURS}
        label="Durée (heures)"
        placeholder={String(DEFAULT_ACCESS_HOURS)}
        hint={`De ${String(MIN_ACCESS_HOURS)} à ${String(MAX_ACCESS_HOURS)} heures. L’accès prend fin à la résolution de la demande.`}
        value={hours}
        onChange={(event) => {
          setHours(event.target.value);
          setFieldError(undefined);
        }}
      />
      {fieldError ? <Alert tone="warning" title="Vérifiez votre saisie">{fieldError}</Alert> : null}
      {failure ? <Alert tone="danger" title="Demande impossible">{failure}</Alert> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <DialogClose asChild>
          <Button variant="ghost">Annuler</Button>
        </DialogClose>
        <Button type="submit" loading={request.isPending}>
          Envoyer la demande
        </Button>
      </div>
    </form>
  );
}
