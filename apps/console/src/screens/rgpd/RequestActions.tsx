'use client';

import { Alert, Button, Checkbox, useToast } from '@eguardimmo/ui';
import Link from 'next/link';
import { useState } from 'react';
import { problemText } from '@/platform/errors';
import { EXTENSION_REASONS, IDENTITY_METHODS, REFUSAL_REASONS } from '@/platform/privacy/privacy';
import type { PrivacyRequest } from '@/platform/privacy/privacy';
import { VERIFICATION_METHOD_LABELS } from '@/platform/labels';
import { ApprovalRequestDialog } from '@/screens/shared/ApprovalRequestDialog';
import { usePendingApproval } from '@/screens/shared/usePendingApproval';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { ChoiceDialog } from './ChoiceDialog';
import { useCompleteRequest, useExtendDeadline, useForwardRequest, useRefuseRequest, useVerifyIdentity } from './hooks';
import { EXTENSION_REASON_LABELS, REFUSAL_REASON_LABELS } from './labels';

const ERASURE = 'privacy.erasure.execute';

type DialogName = 'verify' | 'extend' | 'forward' | 'complete' | 'refuse' | 'erasure';

function pick<T extends string>(candidates: readonly T[], value: string): T {
  const found = candidates.find((candidate) => candidate === value);
  if (found === undefined) throw new Error('Choix invalide.');
  return found;
}

async function settle(run: () => Promise<unknown>): Promise<void> {
  try {
    await run();
  } catch (error) {
    throw new Error(problemText(error));
  }
}

export function RequestActions({ request, canWrite }: { request: PrivacyRequest; canWrite: boolean }) {
  const { show } = useToast();
  const [dialog, setDialog] = useState<DialogName | null>(null);
  const [understood, setUnderstood] = useState(false);
  const [understoodError, setUnderstoodError] = useState(false);
  const pendingErasure = usePendingApproval(request.id, [ERASURE]);
  const verify = useVerifyIdentity(request.id);
  const extend = useExtendDeadline(request.id);
  const forward = useForwardRequest(request.id);
  const complete = useCompleteRequest(request.id);
  const refuse = useRefuseRequest(request.id);
  const open = (name: DialogName) => () => { setDialog(name); };
  const onOpenChange = (name: DialogName) => (next: boolean) => {
    if (!next && dialog === name) {
      setDialog(null);
      if (name === 'erasure') {
        setUnderstood(false);
        setUnderstoodError(false);
      }
    }
  };
  const closed = request.status === 'completed' || request.status === 'refused';
  const canErase = request.kind === 'erasure' && request.requester.accountId !== null;

  return (
    <div className="flex flex-col gap-3">
      {pendingErasure ? (
        <Alert tone="info" title="Effacement en attente d’un second opérateur">
          Demandé par {pendingErasure.requestedBy.name ?? 'un opérateur'}.{' '}
          <Link href="/approbations" className="underline underline-offset-3">
            Voir les approbations
          </Link>
        </Alert>
      ) : null}
      {closed ? (
        <p className="text-body text-fg-muted">Cette demande est close : aucune action n’est plus possible.</p>
      ) : canWrite ? (
        <div className="flex flex-wrap gap-2">
          {request.identityVerifiedAt === null ? <Button variant="secondary" onClick={open('verify')}>Vérifier l’identité</Button> : null}
          {request.extendedUntil === null ? <Button variant="secondary" onClick={open('extend')}>Prolonger le délai</Button> : null}
          <Button variant="secondary" onClick={open('forward')}>Transmettre aux organisations</Button>
          {canErase && pendingErasure === null ? <Button variant="danger" onClick={open('erasure')}>Demander l’effacement du compte</Button> : null}
          <Button onClick={open('complete')}>Clôturer la demande</Button>
          <Button variant="secondary" onClick={open('refuse')}>Refuser la demande</Button>
        </div>
      ) : (
        <p className="text-body text-fg-muted">Seul le rôle Conformité peut traiter cette demande.</p>
      )}
      <ChoiceDialog
        open={dialog === 'verify'}
        onOpenChange={onOpenChange('verify')}
        title="Vérifier l’identité du demandeur"
        description="Aucune pièce n’est conservée : seule la méthode de vérification est enregistrée dans le journal."
        legend="Méthode de vérification"
        options={IDENTITY_METHODS.map((value) => ({ value, label: VERIFICATION_METHOD_LABELS[value] ?? value }))}
        submitLabel="Confirmer la vérification"
        onChoose={(value) =>
          settle(async () => {
            await verify.mutateAsync(pick(IDENTITY_METHODS, value));
            show({ tone: 'success', title: 'Identité vérifiée' });
          })
        }
      />
      <ChoiceDialog
        open={dialog === 'extend'}
        onOpenChange={onOpenChange('extend')}
        title="Prolonger le délai de réponse"
        description="Une seule prolongation, de deux mois, décidée avant l’échéance initiale."
        legend="Motif de la prolongation"
        options={EXTENSION_REASONS.map((value) => ({ value, label: EXTENSION_REASON_LABELS[value] ?? value }))}
        submitLabel="Prolonger le délai"
        onChoose={(value) =>
          settle(async () => {
            await extend.mutateAsync(pick(EXTENSION_REASONS, value));
            show({ tone: 'success', title: 'Délai prolongé' });
          })
        }
      />
      <ChoiceDialog
        open={dialog === 'refuse'}
        onOpenChange={onOpenChange('refuse')}
        title="Refuser la demande"
        description="Le refus est définitif et motivé auprès du demandeur."
        legend="Motif du refus"
        options={REFUSAL_REASONS.map((value) => ({ value, label: REFUSAL_REASON_LABELS[value] ?? value }))}
        submitLabel="Refuser la demande"
        tone="danger"
        onChoose={(value) =>
          settle(async () => {
            await refuse.mutateAsync(pick(REFUSAL_REASONS, value));
            show({ tone: 'success', title: 'Demande refusée' });
          })
        }
      />
      <ConfirmDialog
        open={dialog === 'forward'}
        onOpenChange={onOpenChange('forward')}
        title="Transmettre aux organisations"
        description="La demande est transmise à chaque organisation liée au compte qui ne l’a pas encore reçue. Identité vérifiée requise."
        confirmLabel="Transmettre"
        onConfirm={() =>
          settle(async () => {
            const outcome = await forward.mutateAsync();
            show({ tone: 'success', title: 'Demande transmise', description: `${String(outcome.forwarded)} transmission(s) envoyée(s).` });
          })
        }
      />
      <ConfirmDialog
        open={dialog === 'complete'}
        onOpenChange={onOpenChange('complete')}
        title="Clôturer la demande"
        description="La demande est close et le demandeur en est informé. Cette action est définitive."
        confirmLabel="Clôturer la demande"
        onConfirm={() =>
          settle(async () => {
            await complete.mutateAsync();
            show({ tone: 'success', title: 'Demande clôturée' });
          })
        }
      />
      <ApprovalRequestDialog
        open={dialog === 'erasure'}
        onOpenChange={onOpenChange('erasure')}
        title="Demander l’effacement du compte"
        description="L’effacement est irréversible. Un second opérateur de la conformité doit valider la demande avant toute exécution."
        action={ERASURE}
        subjectId={request.id}
        submitLabel="Demander l’effacement"
        tone="danger"
        beforeSubmit={() => {
          if (understood) return true;
          setUnderstoodError(true);
          return false;
        }}
      >
        <Checkbox
          label="Je comprends que l’effacement du compte est irréversible."
          checked={understood}
          onChange={(event) => { setUnderstood(event.target.checked); setUnderstoodError(false); }}
        />
        {understoodError ? <p role="alert" className="text-caption text-fg-danger">Confirmez que vous avez compris le caractère irréversible.</p> : null}
      </ApprovalRequestDialog>
    </div>
  );
}
