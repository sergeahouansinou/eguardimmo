'use client';

import { Ban, Undo2 } from 'lucide-react';
import { Avatar, Button, Icon, cx } from '@eguardimmo/ui';
import { AttachmentChip } from '../../components/attachments';
import { RichText } from '../../components/RichText';
import { initialsOf } from '../../data/api/shared';
import { formatDateTime } from '../../lib/dates';
import { REDACTION_WINDOW_MS } from '../model';
import type { ThreadAttachment, ThreadMessage } from '../model';

export interface MessageItemProps {
  message: ThreadMessage;
  agencyName: string | null;
  readByAgency: boolean;
  now: number;
  onRedact: (message: ThreadMessage) => void;
  onDownload: (attachment: ThreadAttachment) => void;
}

export function canRedact(message: ThreadMessage, now: number): boolean {
  return message.mine && !message.redacted && now - new Date(message.sentAt).getTime() <= REDACTION_WINDOW_MS;
}

export function MessageItem({ message, agencyName, readByAgency, now, onRedact, onDownload }: MessageItemProps) {
  const fromAgency = message.side === 'agency';
  return (
    <li className={cx('flex min-w-0 gap-2', message.mine && 'flex-row-reverse')}>
      <Avatar initials={initialsOf(message.authorName)} size="md" />
      <article
        aria-label={`Message de ${message.authorName}`}
        className={cx(
          'flex max-w-[min(640px,100%)] min-w-0 flex-col gap-1.5 rounded-lg border px-3 py-2',
          message.mine ? 'border-transparent bg-action-subtle text-fg' : 'border-line bg-surface text-fg',
        )}
      >
        <header className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-caption">
          <strong className="font-semibold break-words">{message.authorName}</strong>
          {fromAgency ? (
            <span className="max-w-full rounded-lg bg-muted px-1.5 py-0.5 text-caption break-words text-fg-muted">
              {agencyName === null ? 'Agence' : `Agence · ${agencyName}`}
            </span>
          ) : null}
          <time dateTime={message.sentAt} className="text-fg-subtle">
            {formatDateTime(message.sentAt)}
          </time>
        </header>
        {message.redacted ? (
          <p className="flex items-center gap-1.5 text-body text-fg-muted italic">
            <Icon icon={Ban} size={14} />
            Message retiré
          </p>
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
        {readByAgency ? <p className="text-caption text-fg-subtle">Lu par l’agence</p> : null}
        {canRedact(message, now) ? (
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
