'use client';

import { Ban, Undo2 } from 'lucide-react';
import { Avatar, Button, Icon, cx } from '@eguardimmo/ui';
import { AttachmentChip } from '../../../components/attachments';
import { RichText } from '../../../components/RichText';
import { initialsOf } from '../../../data/api/shared';
import { formatDateTime } from '../../../lib/dates';
import { REDACTION_WINDOW_MS } from '../../model';
import type { ThreadAttachment } from '../../model';
import { staffKindCopy } from '../copy';
import type { StaffKind, StaffMessage } from '../model';

export interface StaffMessageItemProps {
  message: StaffMessage;
  kind: StaffKind;
  readByCounterpart: boolean;
  redactable: boolean;
  onRedact: (message: StaffMessage) => void;
  onDownload: (attachment: ThreadAttachment) => void;
}

export function canRedactMessage(message: StaffMessage, administer: boolean, now: number): boolean {
  if (message.redacted) return false;
  if (administer) return true;
  return message.mine && now - new Date(message.sentAt).getTime() <= REDACTION_WINDOW_MS;
}

export function StaffMessageItem({ message, kind, readByCounterpart, redactable, onRedact, onDownload }: StaffMessageItemProps) {
  const fromStaff = message.side === 'staff';
  const copy = staffKindCopy[kind];
  return (
    <li className={cx('flex min-w-0 gap-2', fromStaff && 'flex-row-reverse')}>
      <Avatar initials={initialsOf(message.authorName)} size="md" />
      <article
        aria-label={`Message de ${message.authorName}`}
        className={cx(
          'flex max-w-[min(640px,100%)] min-w-0 flex-col gap-1.5 rounded-lg border px-3 py-2',
          fromStaff ? 'border-transparent bg-action-subtle text-fg' : 'border-line bg-surface text-fg',
        )}
      >
        <header className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-caption">
          <strong className="font-semibold break-words">{message.mine ? `${message.authorName} (vous)` : message.authorName}</strong>
          <span className="rounded-lg bg-muted px-1.5 py-0.5 text-caption text-fg-muted">{fromStaff ? 'Équipe' : copy.counterpartBadge}</span>
          <time dateTime={message.sentAt} className="text-fg-subtle">
            {formatDateTime(message.sentAt)}
          </time>
        </header>
        {message.redacted ? (
          <div className="flex flex-col gap-0.5 text-body text-fg-muted italic">
            <p className="flex items-center gap-1.5">
              <Icon icon={Ban} size={14} />
              Message retiré
            </p>
            {message.redactionReason ? <p className="text-caption break-words">{`Motif : ${message.redactionReason}`}</p> : null}
          </div>
        ) : (
          <p className="text-body break-words whitespace-pre-wrap">
            <RichText text={message.body} />
          </p>
        )}
        {message.attachments.length > 0 ? (
          <ul aria-label="Pièces jointes" className="flex flex-wrap gap-1.5">
            {message.attachments.map((attachment) => (
              <li key={attachment.id} className="flex max-w-full min-w-0">
                <AttachmentChip
                  name={attachment.name}
                  sizeBytes={attachment.sizeBytes}
                  mimeType={attachment.mimeType}
                  onOpen={() => { onDownload(attachment); }}
                />
              </li>
            ))}
          </ul>
        ) : null}
        {readByCounterpart ? <p className="text-caption text-fg-subtle">{copy.readBy}</p> : null}
        {redactable ? (
          <div>
            <Button variant="ghost" size="sm" onClick={() => { onRedact(message); }}>
              <Icon icon={Undo2} />
              Retirer ce message
            </Button>
          </div>
        ) : null}
      </article>
    </li>
  );
}
