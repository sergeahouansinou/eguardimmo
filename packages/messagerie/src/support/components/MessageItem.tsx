'use client';

import { Avatar, cx } from '@eguardimmo/ui';
import { AttachmentChip } from '../../components/attachments';
import { initialsOf } from '../../data/api/shared';
import { formatDateTime } from '../../lib/dates';
import type { SupportAttachment, SupportMessage } from '../model';

export interface MessageItemProps {
  message: SupportMessage;
  readBySupport: boolean;
  onDownload: (attachment: SupportAttachment) => void;
}

export function MessageItem({ message, readBySupport, onDownload }: MessageItemProps) {
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
          <time dateTime={message.sentAt} className="text-fg-subtle">
            {formatDateTime(message.sentAt)}
          </time>
        </header>
        <p className="text-body break-words whitespace-pre-wrap">{message.body}</p>
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
        {readBySupport ? <p className="text-caption text-fg-subtle">Lu par le support</p> : null}
      </article>
    </li>
  );
}
