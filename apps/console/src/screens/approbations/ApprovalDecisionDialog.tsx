'use client';

import { usePlatformMutation } from '@/platform/context';
import { APPROVAL_ACTION_LABELS, labelOf } from '@/platform/labels';
import type { Approval } from '@/platform/approvals/approvals';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { useNotify } from '@/ui/notify';

export type Decision = 'approve' | 'reject' | 'cancel';

const COPY: Record<Decision, { title: string; confirm: string; tone: 'primary' | 'danger'; done: string; text: string }> = {
  approve: {
    title: 'Valider la demande',
    confirm: 'Valider et exécuter',
    tone: 'primary',
    done: 'Demande validée',
    text: 'L’action sera exécutée immédiatement. Un code de double authentification vous sera demandé.',
  },
  reject: {
    title: 'Refuser la demande',
    confirm: 'Refuser',
    tone: 'danger',
    done: 'Demande refusée',
    text: 'Rien ne sera modifié. Un code de double authentification vous sera demandé.',
  },
  cancel: {
    title: 'Annuler ma demande',
    confirm: 'Annuler la demande',
    tone: 'danger',
    done: 'Demande annulée',
    text: 'La demande sera retirée de la file des validations. Un code de double authentification vous sera demandé.',
  },
};

export interface ApprovalDecisionDialogProps {
  approval: Approval | null;
  decision: Decision | null;
  onClose: (done: boolean) => void;
}

export function ApprovalDecisionDialog({ approval, decision, onClose }: ApprovalDecisionDialogProps) {
  const notify = useNotify();
  const run = usePlatformMutation((api, input: { id: string; decision: Decision }) => api.approvals[input.decision](input.id));
  if (approval === null || decision === null) return null;
  const copy = COPY[decision];
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => { if (!open) onClose(false); }}
      title={copy.title}
      description={`${labelOf(APPROVAL_ACTION_LABELS, approval.action)} : ${copy.text}`}
      confirmLabel={copy.confirm}
      tone={copy.tone}
      onConfirm={async () => {
        await run.mutateAsync({ id: approval.id, decision });
        notify.success(copy.done);
        onClose(true);
      }}
    />
  );
}
