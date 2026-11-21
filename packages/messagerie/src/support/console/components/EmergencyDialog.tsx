'use client';

import { useState } from 'react';
import { Alert, Button, Checkbox, Dialog, DialogClose, DialogContent, RadioGroup, Textarea } from '@eguardimmo/ui';
import { basisLabel } from '../../access/copy';
import type { EmergencyBasis } from '../../access/model';
import { consoleErrorMessage } from '../api/errors';
import { EMERGENCY_WARNINGS } from '../copy';
import { REASON_MAX, REASON_MIN } from '../model';
import { useOpenEmergency } from '../queries';
import type { AccessDialogProps } from './RequestAccessDialog';

const BASES: readonly EmergencyBasis[] = ['security_incident', 'legal_requisition'];

function isBasis(value: string): value is EmergencyBasis {
  return (BASES as readonly string[]).includes(value);
}

export function EmergencyDialog({ ticketId, organizationName, open, onClose }: AccessDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent
        title="Ouvrir un accès d’urgence"
        description={`Accès sans le consentement de ${organizationName ?? 'l’organisation'}, réservé à un incident de sécurité ou à une réquisition légale.`}
        className="max-w-[560px]"
      >
        {open ? <EmergencyForm ticketId={ticketId} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function EmergencyForm({ ticketId, onClose }: { ticketId: string; onClose: () => void }) {
  const emergency = useOpenEmergency(ticketId);
  const [basis, setBasis] = useState<EmergencyBasis>('security_incident');
  const [reason, setReason] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [failure, setFailure] = useState<string | null>(null);
  const submit = () => {
    const trimmed = reason.trim();
    if (trimmed.length < REASON_MIN || trimmed.length > REASON_MAX) {
      setFieldError(`Le motif doit faire de ${String(REASON_MIN)} à ${String(REASON_MAX)} caractères.`);
      return;
    }
    if (!acknowledged) {
      setFieldError('Confirmez avoir pris connaissance des conséquences de l’accès d’urgence.');
      return;
    }
    setFieldError(undefined);
    setFailure(null);
    emergency.mutate({ reason: trimmed, basis }, { onSuccess: onClose, onError: (error) => { setFailure(consoleErrorMessage(error)); } });
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
      <Alert tone="danger" title="Avant d’ouvrir cet accès">
        <ul className="list-disc pl-5">
          {EMERGENCY_WARNINGS.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      </Alert>
      <RadioGroup
        label="Fondement de l’accès"
        options={BASES.map((value) => ({ value, label: basisLabel[value] }))}
        value={basis}
        onValueChange={(value) => { if (isBasis(value)) setBasis(value); }}
      />
      <Textarea
        data-autofocus
        label="Motif *"
        placeholder="Ex. Compromission suspectée d’un compte administrateur de l’organisation"
        hint={`${String(REASON_MIN)} à ${String(REASON_MAX)} caractères. Ce motif est consigné dans le journal et lu par un second opérateur.`}
        rows={3}
        maxLength={REASON_MAX}
        value={reason}
        onChange={(event) => {
          setReason(event.target.value);
          setFieldError(undefined);
        }}
      />
      <Checkbox
        label="Je comprends que l’organisation est prévenue et que cet accès sera revu par un autre opérateur."
        checked={acknowledged}
        onChange={(event) => {
          setAcknowledged(event.target.checked);
          setFieldError(undefined);
        }}
      />
      {fieldError ? <Alert tone="warning" title="Vérifiez votre saisie">{fieldError}</Alert> : null}
      {failure ? <Alert tone="danger" title="Ouverture impossible">{failure}</Alert> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <DialogClose asChild>
          <Button variant="ghost">Annuler</Button>
        </DialogClose>
        <Button type="submit" variant="danger" loading={emergency.isPending}>
          Ouvrir l’accès d’urgence
        </Button>
      </div>
    </form>
  );
}
