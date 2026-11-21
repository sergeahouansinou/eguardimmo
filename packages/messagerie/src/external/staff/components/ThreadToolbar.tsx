'use client';

import { Archive, ArchiveRestore, Ban, CircleCheck, LockOpen, MailCheck, RotateCcw } from 'lucide-react';
import { useMemo } from 'react';
import { Button, Icon, Select } from '@eguardimmo/ui';
import { useStaffConfig } from '../context';
import type { StaffThreadDetail } from '../model';
import { useStaffAssignees } from '../queries';

const NONE = 'none';

export interface ThreadToolbarProps {
  thread: StaffThreadDetail;
  busy: boolean;
  onRead: () => void;
  onArchive: () => void;
  onStatus: () => void;
  onAssign: (assigneeId: string | null) => void;
  onRestrict: () => void;
  onLift: () => void;
}

export function ThreadToolbar({ thread, busy, onRead, onArchive, onStatus, onAssign, onRestrict, onLift }: ThreadToolbarProps) {
  const { capabilities } = useStaffConfig();
  const assignees = useStaffAssignees();
  const options = useMemo(() => {
    const known = assignees.data ?? [];
    const list = known.map((member) => ({ value: member.id, label: member.name }));
    if (thread.assignee !== null && !known.some((member) => member.id === thread.assignee?.id)) {
      list.push({ value: thread.assignee.id, label: thread.assignee.name ?? 'Ancien membre' });
    }
    return [{ value: NONE, label: 'Non assignée' }, ...list];
  }, [assignees.data, thread.assignee]);
  const restricted = thread.mutedUntil !== null;

  return (
    <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
      <div className="w-full min-w-0 sm:w-64">
        <Select
          label="Assignée à"
          placeholder="Non assignée"
          value={thread.assignee?.id ?? NONE}
          disabled={busy || assignees.isPending}
          onValueChange={(value) => { onAssign(value === NONE ? null : value); }}
          options={options}
          {...(assignees.isError ? { hint: 'La liste de l’équipe n’a pas pu être chargée.' } : {})}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {thread.unread ? (
          <Button variant="secondary" disabled={busy} onClick={onRead}>
            <Icon icon={MailCheck} />
            Marquer comme lu
          </Button>
        ) : null}
        <Button variant="secondary" disabled={busy} onClick={onStatus}>
          <Icon icon={thread.status === 'open' ? CircleCheck : RotateCcw} />
          {thread.status === 'open' ? 'Fermer la conversation' : 'Rouvrir la conversation'}
        </Button>
        <Button variant="secondary" disabled={busy} onClick={onArchive}>
          <Icon icon={thread.archived ? ArchiveRestore : Archive} />
          {thread.archived ? 'Désarchiver' : 'Archiver'}
        </Button>
        {capabilities.administer ? (
          <Button variant="secondary" disabled={busy} onClick={restricted ? onLift : onRestrict}>
            <Icon icon={restricted ? LockOpen : Ban} />
            {restricted ? 'Lever la restriction' : 'Restreindre l’envoi'}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
