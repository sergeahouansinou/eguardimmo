'use client';

import { useState } from 'react';
import { Alert, Button, Checkbox, Dialog, DialogClose, DialogContent, TextField } from '@eguardimmo/ui';
import type { StaffProof } from '../../../external/staff/context';
import { accessErrorMessage } from '../api/errors';
import { scopeHint, scopeLabel } from '../copy';
import { DEFAULT_ACCESS_HOURS, MAX_ACCESS_HOURS, MIN_ACCESS_HOURS } from '../model';
import type { AccessGrant, AccessScope } from '../model';
import { useAcceptAccess } from '../queries';

export interface AcceptDialogProps {
  grant: AccessGrant | null;
  proof: StaffProof;
  onClose: () => void;
}

export function maxHoursOf(grant: AccessGrant): number {
  return Math.min(grant.durationHours ?? MAX_ACCESS_HOURS, MAX_ACCESS_HOURS);
}

export function AcceptDialog({ grant, proof, onClose }: AcceptDialogProps) {
  return (
    <Dialog open={grant !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        title="Accepter l’accès du support ?"
        description="L’accès est en lecture seule et prend fin à la résolution de la demande. Vous pouvez réduire la durée et le périmètre demandés, jamais les dépasser."
        className="max-w-[520px]"
      >
        {grant === null ? null : <AcceptForm grant={grant} proof={proof} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function AcceptForm({ grant, proof, onClose }: { grant: AccessGrant; proof: StaffProof; onClose: () => void }) {
  const accept = useAcceptAccess();
  const maxHours = maxHoursOf(grant);
  const [hours, setHours] = useState(String(Math.min(DEFAULT_ACCESS_HOURS, maxHours)));
  const [scopes, setScopes] = useState<AccessScope[]>(grant.scopes);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [failure, setFailure] = useState<string | null>(null);

  const run = () => {
    accept.mutate(
      { id: grant.id, input: { durationHours: Number(hours), scopes } },
      {
        onSuccess: onClose,
        onError: (error) => {
          if (proof.intercept(error, run)) return;
          setFailure(accessErrorMessage(error));
        },
      },
    );
  };

  const submit = () => {
    const value = Number(hours);
    if (!Number.isInteger(value) || value < MIN_ACCESS_HOURS || value > maxHours) {
      setFieldError(`Indiquez une durée entière de ${String(MIN_ACCESS_HOURS)} à ${String(maxHours)} heures.`);
      return;
    }
    if (scopes.length === 0) {
      setFieldError('Autorisez au moins un périmètre, ou refusez l’accès.');
      return;
    }
    setFieldError(undefined);
    setFailure(null);
    run();
  };

  const toggle = (scope: AccessScope, checked: boolean) => {
    setScopes(grant.scopes.filter((candidate) => (candidate === scope ? checked : scopes.includes(candidate))));
    setFieldError(undefined);
  };

  return (
    <form
      noValidate
      className="flex flex-col gap-4 px-4 pt-3 pb-4"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        submit();
      }}
    >
      <TextField
        data-autofocus
        type="number"
        inputMode="numeric"
        min={MIN_ACCESS_HOURS}
        max={maxHours}
        label="Durée de l’accès (heures)"
        placeholder={String(DEFAULT_ACCESS_HOURS)}
        hint={`Au plus ${String(maxHours)} heures (durée demandée, 72 heures maximum).`}
        value={hours}
        onChange={(event) => {
          setHours(event.target.value);
          setFieldError(undefined);
        }}
      />
      <fieldset className="flex min-w-0 flex-col gap-2">
        <legend className="text-body font-medium text-fg">Périmètre autorisé</legend>
        {grant.scopes.map((scope) => (
          <div key={scope} className="flex min-w-0 flex-col gap-0.5">
            <Checkbox label={scopeLabel[scope]} checked={scopes.includes(scope)} onChange={(event) => { toggle(scope, event.target.checked); }} />
            <span className="pl-6 text-caption text-fg-muted">{scopeHint[scope]}</span>
          </div>
        ))}
      </fieldset>
      {fieldError ? <Alert tone="warning" title="Vérifiez votre saisie">{fieldError}</Alert> : null}
      {failure ? <Alert tone="danger" title="Acceptation impossible">{failure}</Alert> : null}
      <p className="text-caption text-fg-muted">La double authentification est demandée pour confirmer votre décision.</p>
      <div className="flex flex-wrap justify-end gap-2">
        <DialogClose asChild>
          <Button variant="ghost">Annuler</Button>
        </DialogClose>
        <Button type="submit" loading={accept.isPending}>
          Accepter l’accès
        </Button>
      </div>
    </form>
  );
}
