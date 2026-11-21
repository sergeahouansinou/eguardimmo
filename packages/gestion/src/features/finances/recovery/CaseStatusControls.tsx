'use client';

import { Button, ConfirmDialog } from '@eguardimmo/ui';
import { useState } from 'react';
import { NoteDialog } from './NoteDialog';
import { useChangeStatus, useRecoveryPermissions } from './hooks';
import { isActive } from './labels';
import type { CaseStatus, RecoveryCase } from './model';
import { errorMessage, useNotify } from '../../locataires/kit';

type Pending = 'plan' | 'reopen' | 'close' | 'uncollectible' | null;

const DONE: Record<Exclude<Pending, null>, string> = {
  plan: 'Dossier placé en plan de paiement.',
  reopen: 'Dossier rouvert.',
  close: 'Dossier clos : il n’accepte plus de modification.',
  uncollectible: 'Dossier déclaré irrécouvrable : il n’accepte plus de modification.',
};

const TARGET: Record<Exclude<Pending, null>, CaseStatus> = { plan: 'in_plan', reopen: 'open', close: 'closed', uncollectible: 'uncollectible' };

export function CaseStatusControls({ recoveryCase }: { recoveryCase: RecoveryCase }) {
  const permissions = useRecoveryPermissions();
  const notify = useNotify();
  const change = useChangeStatus();
  const [pending, setPending] = useState<Pending>(null);

  if (!permissions.write || !isActive(recoveryCase.status)) return null;

  const run = async (kind: Exclude<Pending, null>, reason: string) => {
    try {
      await change.mutateAsync({ caseId: recoveryCase.id, status: TARGET[kind], reason });
      notify({ title: 'Statut modifié', description: DONE[kind] });
    } catch (error) {
      notify({ tone: 'danger', title: 'Changement de statut impossible', description: errorMessage(error) });
    } finally {
      setPending(null);
    }
  };

  return (
    <>
      {recoveryCase.status === 'open' ? <Button variant="secondary" onClick={() => { setPending('plan'); }}>Passer en plan de paiement</Button> : null}
      {recoveryCase.status === 'in_plan' ? <Button variant="secondary" onClick={() => { setPending('reopen'); }}>Rouvrir le dossier</Button> : null}
      <Button variant="secondary" onClick={() => { setPending('close'); }}>Clore le dossier</Button>
      <Button variant="danger" onClick={() => { setPending('uncollectible'); }}>Déclarer irrécouvrable</Button>
      <ConfirmDialog
        open={pending === 'plan'}
        onOpenChange={(open) => { if (!open) setPending(null); }}
        title="Passer en plan de paiement ?"
        description="Le dossier reste actif : créances, diligences et envois restent possibles. Vous pourrez le rouvrir."
        confirmLabel="Passer en plan"
        loading={change.isPending}
        onConfirm={() => { void run('plan', ''); }}
      />
      <ConfirmDialog
        open={pending === 'reopen'}
        onOpenChange={(open) => { if (!open) setPending(null); }}
        title="Rouvrir le dossier ?"
        description="Le dossier repasse au statut ouvert."
        confirmLabel="Rouvrir"
        loading={change.isPending}
        onConfirm={() => { void run('reopen', ''); }}
      />
      <NoteDialog
        open={pending === 'close'}
        title="Clore le dossier ?"
        description="Un dossier clos est définitif : il n’accepte plus de créance, de diligence ni d’envoi. Les créances sont libérées."
        confirmLabel="Clore le dossier"
        placeholder="Ex. Réglé à l’amiable"
        tone="danger"
        loading={change.isPending}
        onConfirm={(reason) => { void run('close', reason); }}
        onClose={() => { setPending(null); }}
      />
      <NoteDialog
        open={pending === 'uncollectible'}
        title="Déclarer le dossier irrécouvrable ?"
        description="Cette décision est définitive : le dossier n’accepte plus aucune modification."
        confirmLabel="Déclarer irrécouvrable"
        placeholder="Ex. Locataire insolvable"
        tone="danger"
        loading={change.isPending}
        onConfirm={(reason) => { void run('uncollectible', reason); }}
        onClose={() => { setPending(null); }}
      />
    </>
  );
}
