'use client';

import { Button, Icon } from '@eguardimmo/ui';
import type { SelectOption } from '@eguardimmo/ui';
import { CalendarClock, CheckCircle2, UserRound } from 'lucide-react';
import { useState } from 'react';
import { useNotify } from '../../locataires/kit';
import { ConfirmAction, todayIn, useOrgTimezone } from '../../orgapi';
import { useBulkAssign, useBulkComplete, useBulkPostpone } from '../hooks';
import { AssignDialog, PostponeDialog } from './TaskBulkDialogs';

type Dialogs = 'complete' | 'postpone' | 'assign' | null;

const plural = (count: number, one: string, many: string): string => `${String(count)} ${count > 1 ? many : one}`;

export function TaskBulkBar({ ids, assigneeOptions, onDone, onClear }: { ids: readonly string[]; assigneeOptions: readonly SelectOption[]; onDone: () => void; onClear: () => void }) {
  const notify = useNotify();
  const timezone = useOrgTimezone();
  const complete = useBulkComplete();
  const postpone = useBulkPostpone();
  const assign = useBulkAssign();
  const [dialog, setDialog] = useState<Dialogs>(null);
  const count = ids.length;
  if (count === 0) return null;

  const close = () => { setDialog(null); };
  const done = (title: string, processed: number) => {
    notify({ title, description: plural(processed, 'tâche traitée', 'tâches traitées') });
    close();
    onDone();
  };

  return (
    <div role="region" aria-label="Actions groupées" className="flex flex-wrap items-center gap-2 rounded-md bg-action-subtle px-3 py-2">
      <span className="text-body-strong text-action-on-subtle" aria-live="polite">{plural(count, 'tâche sélectionnée', 'tâches sélectionnées')}</span>
      <Button size="sm" onClick={() => { setDialog('complete'); }}>
        <Icon icon={CheckCircle2} />
        Terminer
      </Button>
      <Button size="sm" variant="secondary" onClick={() => { setDialog('postpone'); }}>
        <Icon icon={CalendarClock} />
        Reporter
      </Button>
      <Button size="sm" variant="secondary" onClick={() => { setDialog('assign'); }}>
        <Icon icon={UserRound} />
        Assigner
      </Button>
      <Button size="sm" variant="ghost" onClick={onClear}>Tout désélectionner</Button>
      <ConfirmAction
        open={dialog === 'complete'}
        title="Terminer les tâches sélectionnées ?"
        description={`${plural(count, 'tâche sera marquée', 'tâches seront marquées')} comme terminée${count > 1 ? 's' : ''}. Tout ou rien : si l’une d’elles n’est plus ouverte, aucune n’est modifiée.`}
        confirmLabel="Terminer"
        failureTitle="Tâches non terminées"
        run={async () => { done('Tâches terminées', await complete.mutateAsync(ids)); }}
        onClose={close}
      />
      <PostponeDialog open={dialog === 'postpone'} count={count} defaultDueOn={todayIn(timezone.data ?? 'UTC')} onClose={close} onConfirm={async (dueOn) => { done('Échéances reportées', await postpone.mutateAsync({ ids, dueOn })); }} />
      <AssignDialog open={dialog === 'assign'} count={count} options={assigneeOptions} onClose={close} onConfirm={async (assigneeUserId) => { done('Tâches assignées', await assign.mutateAsync({ ids, assigneeUserId })); }} />
    </div>
  );
}
