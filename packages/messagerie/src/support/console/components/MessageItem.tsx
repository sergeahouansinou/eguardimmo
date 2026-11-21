'use client';

import { Lock, Send } from 'lucide-react';
import { Avatar, Icon, cx } from '@eguardimmo/ui';
import { AttachmentChip } from '../../../components/attachments';
import { initialsOf } from '../../../data/api/shared';
import { formatDateTime } from '../../../lib/dates';
import type { SupportAttachment } from '../../model';
import type { ConsoleMessage } from '../model';

export interface ConsoleMessageItemProps {
  message: ConsoleMessage;
  requesterName: string;
  readByRequester: boolean;
  onDownload: (attachment: SupportAttachment) => void;
}

export function ConsoleMessageItem({ message, requesterName, readByRequester, onDownload }: ConsoleMessageItemProps) {
  const internal = message.internal;
  const label = internal ? 'Note interne de' : message.fromSupport ? 'Réponse de' : 'Message de';
  return (
    <li className={cx('flex min-w-0 gap-2', message.fromSupport && 'flex-row-reverse')}>
      <Avatar initials={initialsOf(message.authorName)} size="md" />
      <article
        aria-label={`${label} ${message.authorName}`}
        className={cx(
          'flex max-w-[min(640px,100%)] min-w-0 flex-col gap-1.5 rounded-lg border px-3 py-2',
          internal && 'border-2 border-dashed border-warning-line bg-warning text-warning-fg',
          !internal && message.fromSupport && 'border-transparent bg-action-subtle text-fg',
          !internal && !message.fromSupport && 'border-line bg-surface text-fg',
        )}
      >
        {internal ? (
          <p className="flex items-center gap-1.5 text-caption font-semibold">
            <Icon icon={Lock} size={14} />
            Note interne : invisible pour le demandeur
          </p>
        ) : message.fromSupport ? (
          <p className="flex items-center gap-1.5 text-caption text-fg-muted">
            <Icon icon={Send} size={14} />
            {`Réponse envoyée à ${requesterName}`}
          </p>
        ) : null}
        <header className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-caption">
          <strong className="font-semibold break-words">{message.authorName}</strong>
          <time dateTime={message.sentAt} className={internal ? '' : 'text-fg-subtle'}>
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
        {readByRequester ? <p className="text-caption text-fg-subtle">Lu par le demandeur</p> : null}
      </article>
    </li>
  );
}
