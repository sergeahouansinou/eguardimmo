'use client';

import { Archive, ArchiveRestore, Ellipsis, MailCheck, Paperclip } from 'lucide-react';
import { Avatar, Badge, Icon, IconButton, Menu, MenuContent, MenuItem, MenuTrigger, cx } from '@eguardimmo/ui';
import { initialsOf } from '../../../data/api/shared';
import { formatDayMonthTime } from '../../../lib/dates';
import { stripRichText } from '../../../lib/richText';
import { useStaffConfig } from '../context';
import { staffKindCopy } from '../copy';
import type { StaffThreadSummary } from '../model';

export interface StaffThreadRowProps {
  thread: StaffThreadSummary;
  onRead: (thread: StaffThreadSummary) => void;
  onArchive: (thread: StaffThreadSummary) => void;
}

export function previewOf(thread: StaffThreadSummary): string {
  const text = stripRichText(thread.preview);
  return thread.lastAuthorSide === 'staff' ? `${thread.lastAuthorName ?? 'Équipe'} : ${text}` : text;
}

export function StaffThreadRow({ thread, onRead, onArchive }: StaffThreadRowProps) {
  const { Link, routes } = useStaffConfig();
  const name = thread.party.name ?? 'Contact';
  const reference = thread.lease ?? thread.mandate;
  const referenceLabel = thread.lease ? `${staffKindCopy.tenant.referenceLabel} ${reference?.reference ?? ''}`.trim() : `${staffKindCopy.owner.referenceLabel} ${reference?.reference ?? ''}`.trim();
  const muted = thread.mutedUntil !== null;
  return (
    <li className="flex min-w-0 items-stretch border-b border-line last:border-b-0">
      <Link
        href={routes.thread(thread.id)}
        className={cx(
          'flex min-w-0 flex-1 items-start gap-3 px-3 py-3 hover:bg-muted',
          'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
        )}
      >
        <Avatar initials={initialsOf(name)} size="md" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex min-w-0 items-baseline justify-between gap-2">
            <span className={cx('min-w-0 truncate text-body', thread.unread ? 'font-semibold text-fg' : 'text-fg')}>
              {thread.unread ? <span className="sr-only">Non lu, </span> : null}
              {name}
              <span className="font-normal text-fg-muted">{` · ${thread.subject}`}</span>
            </span>
            <time dateTime={thread.lastMessageAt} className="shrink-0 text-caption text-fg-subtle">
              {formatDayMonthTime(thread.lastMessageAt)}
            </time>
          </span>
          <span className="truncate text-caption text-fg-muted">{previewOf(thread)}</span>
          <span className="flex flex-wrap items-center gap-1.5">
            {reference ? <Badge wrap>{referenceLabel}</Badge> : null}
            {thread.awaitingReply ? <Badge tone="info">À répondre</Badge> : null}
            {thread.status === 'closed' ? <Badge tone="warning">Fermée</Badge> : null}
            {muted ? <Badge tone="warning">Restreinte</Badge> : null}
            {thread.assignee ? <span className="text-caption text-fg-subtle">{`Assignée à ${thread.assignee.name ?? 'un membre'}`}</span> : null}
            {thread.hasAttachments ? <Icon icon={Paperclip} size={14} label="Pièce jointe" className="text-fg-subtle" /> : null}
          </span>
        </span>
        {thread.unread ? <span aria-hidden="true" className="mt-2 size-2 shrink-0 rounded-full bg-action" /> : null}
      </Link>
      <div className="flex items-start px-1.5 py-3">
        <Menu>
          <MenuTrigger asChild>
            <IconButton label={`Actions pour ${thread.subject}`} icon={Ellipsis} />
          </MenuTrigger>
          <MenuContent>
            {thread.unread ? (
              <MenuItem icon={MailCheck} onSelect={() => { onRead(thread); }}>
                Marquer comme lu
              </MenuItem>
            ) : null}
            <MenuItem icon={thread.archived ? ArchiveRestore : Archive} onSelect={() => { onArchive(thread); }}>
              {thread.archived ? 'Désarchiver' : 'Archiver'}
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>
    </li>
  );
}
