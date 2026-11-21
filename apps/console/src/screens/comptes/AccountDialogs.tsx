'use client';

import { RadioGroup } from '@eguardimmo/ui';
import { useState } from 'react';
import { ACCOUNT_SUSPENSION_REASONS, VERIFICATION_METHODS } from '@/platform/accounts/accounts';
import type { AccountSuspensionReason } from '@/platform/accounts/accounts';
import { SUSPENSION_REASON_LABELS, VERIFICATION_METHOD_LABELS } from '@/platform/labels';
import { ApprovalRequestDialog } from '../shared/ApprovalRequestDialog';
import { ActionDialog } from './ActionDialog';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  accountName: string;
}

const pickReason = (value: string): AccountSuspensionReason | undefined => ACCOUNT_SUSPENSION_REASONS.find((reason) => reason === value);

export function RevokeSessionsDialog({ open, onOpenChange, accountId, accountName }: DialogProps) {
  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Révoquer les sessions de ${accountName}`}
      description="Tous les appareils et jetons du compte seront déconnectés immédiatement. Le compte pourra se reconnecter normalement."
      confirmLabel="Révoquer les sessions"
      tone="danger"
      successTitle="Sessions révoquées"
      run={(api) => api.accounts.revokeSessions(accountId)}
    />
  );
}

export function SuspendAccountDialog({ open, onOpenChange, accountId, accountName }: DialogProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  return (
    <ActionDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setReason('');
          setError(undefined);
        }
        onOpenChange(next);
      }}
      title={`Suspendre ${accountName}`}
      description="Effet immédiat : le compte est déconnecté et ne peut plus se connecter. Une revue a posteriori par l’administration ou la conformité est requise."
      confirmLabel="Suspendre le compte"
      tone="danger"
      successTitle="Compte suspendu"
      beforeSubmit={() => {
        if (pickReason(reason) === undefined) {
          setError('Choisissez un motif de suspension.');
          return false;
        }
        return true;
      }}
      run={(api) => {
        const chosen = pickReason(reason);
        if (chosen === undefined) return Promise.reject(new Error('Motif manquant'));
        return api.accounts.suspend(accountId, chosen);
      }}
    >
      <RadioGroup
        label="Motif de suspension"
        options={ACCOUNT_SUSPENSION_REASONS.map((value) => ({ value, label: SUSPENSION_REASON_LABELS[value] ?? value }))}
        value={reason}
        error={error}
        onValueChange={(value) => {
          setReason(value);
          setError(undefined);
        }}
      />
    </ActionDialog>
  );
}

export function ReviewSuspensionDialog({ open, onOpenChange, accountId, accountName }: DialogProps) {
  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Revoir la suspension de ${accountName}`}
      description="Confirme que la suspension a été examinée a posteriori. L’opérateur qui a suspendu ne peut pas faire cette revue."
      confirmLabel="Marquer comme revue"
      successTitle="Suspension revue"
      run={(api) => api.accounts.reviewSuspension(accountId)}
    />
  );
}

export function ReactivateAccountDialog({ open, onOpenChange, accountId, accountName }: DialogProps) {
  return (
    <ApprovalRequestDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Réactiver ${accountName}`}
      description="Le compte pourra de nouveau se connecter. Un second opérateur doit valider la demande."
      action="identity.account.reactivate"
      subjectId={accountId}
      submitLabel="Demander la réactivation"
    />
  );
}

export function ResetTwoFactorDialog({ open, onOpenChange, accountId, accountName }: DialogProps) {
  const [method, setMethod] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  return (
    <ApprovalRequestDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setMethod('');
          setError(undefined);
        }
        onOpenChange(next);
      }}
      title={`Réinitialiser la double authentification de ${accountName}`}
      description="La double authentification et les codes de secours seront supprimés ; le compte devra la reconfigurer. Un second opérateur doit valider la demande."
      action="identity.account.reset_two_factor"
      subjectId={accountId}
      submitLabel="Demander la réinitialisation"
      tone="danger"
      payload={method === '' ? undefined : { verification_method: method }}
      beforeSubmit={() => {
        if (!VERIFICATION_METHODS.some((item) => item === method)) {
          setError('Indiquez comment l’identité du titulaire a été vérifiée.');
          return false;
        }
        return true;
      }}
    >
      <RadioGroup
        label="Vérification d’identité effectuée"
        options={VERIFICATION_METHODS.map((value) => ({ value, label: VERIFICATION_METHOD_LABELS[value] ?? value }))}
        value={method}
        error={error}
        onValueChange={(value) => {
          setMethod(value);
          setError(undefined);
        }}
      />
    </ApprovalRequestDialog>
  );
}
