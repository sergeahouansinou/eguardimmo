import { Lock } from 'lucide-react';
import { Avatar, Icon, cx } from '@eguardimmo/ui';
import { formatDateTime } from '../lib/dates';
import type { Message, Participant } from '../data/schemas';
import { AttachmentChip } from './attachments';

export interface MessageBubbleProps {
  message: Message;
  author: Participant | undefined;
  own: boolean;
}

export function MessageBubble({ message, author, own }: MessageBubbleProps) {
  const name = author?.name ?? 'Participant inconnu';
  return (
    <li className={cx('flex min-w-0 gap-2', own && 'flex-row-reverse')}>
      <Avatar initials={author?.initials ?? '?'} size="md" />
      <article
        aria-label={`Message de ${name}`}
        className={cx(
          'flex max-w-[min(640px,100%)] min-w-0 flex-col gap-1.5 rounded-lg border px-3 py-2',
          message.internal
            ? 'border-warning-line bg-warning text-warning-fg'
            : own
              ? 'border-transparent bg-action-subtle text-fg'
              : 'border-line bg-surface text-fg',
        )}
      >
        <header className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-caption">
          <strong className="font-semibold">{name}</strong>
          {message.internal ? (
            <span className="inline-flex items-center gap-1 font-semibold">
              <Icon icon={Lock} size={14} />
              Note interne
            </span>
          ) : null}
          <time dateTime={message.sentAt} className={message.internal ? undefined : 'text-fg-subtle'}>
            {formatDateTime(message.sentAt)}
          </time>
        </header>
        <p className="text-body break-words whitespace-pre-wrap">{message.body}</p>
        {message.attachments.length > 0 ? (
          <ul aria-label="Pièces jointes" className="flex flex-wrap gap-1.5">
            {message.attachments.map((attachment) => (
              <li key={attachment.id} className="flex max-w-full min-w-0">
                <AttachmentChip name={attachment.name} sizeBytes={attachment.sizeBytes} mimeType={attachment.mimeType} />
              </li>
            ))}
          </ul>
        ) : null}
      </article>
    </li>
  );
}
