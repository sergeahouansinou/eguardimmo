'use client';

import { RadioGroup } from '@eguardimmo/ui';
import { useState } from 'react';
import { ORGANISATION_SUSPENSION_REASONS } from '@/platform/organisations/organisations';
import { SUSPENSION_REASON_LABELS } from '@/platform/labels';
import { ApprovalRequestDialog } from '../shared/ApprovalRequestDialog';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organisationId: string;
  organisationName: string;
}

export function SuspendOrganisationDialog({ open, onOpenChange, organisationId, organisationName }: DialogProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  return (
    <ApprovalRequestDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setReason('');
          setError(undefined);
        }
        onOpenChange(next);
      }}
      title={`Suspendre ${organisationName}`}
      description="Les écritures de l’organisation seront refusées ; ses lectures et ses exports restent ouverts. Un second opérateur doit valider la demande."
      action="organizations.suspend"
      subjectId={organisationId}
      submitLabel="Demander la suspension"
      tone="danger"
      payload={reason === '' ? undefined : { reason_code: reason }}
      beforeSubmit={() => {
        if (reason === '') {
          setError('Choisissez un motif de suspension.');
          return false;
        }
        return true;
      }}
    >
      <RadioGroup
        label="Motif de suspension"
        options={ORGANISATION_SUSPENSION_REASONS.map((value) => ({ value, label: SUSPENSION_REASON_LABELS[value] ?? value }))}
        value={reason}
        error={error}
        onValueChange={(value) => {
          setReason(value);
          setError(undefined);
        }}
      />
      <p className="text-caption text-fg-subtle">Un impayé ne justifie jamais une suspension : l’organisation repasse alors sur le plan Gratuit.</p>
    </ApprovalRequestDialog>
  );
}

export function ReactivateOrganisationDialog({ open, onOpenChange, organisationId, organisationName }: DialogProps) {
  return (
    <ApprovalRequestDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Réactiver ${organisationName}`}
      description="Les écritures de l’organisation seront de nouveau acceptées. Un second opérateur doit valider la demande."
      action="organizations.reactivate"
      subjectId={organisationId}
      submitLabel="Demander la réactivation"
    />
  );
}
