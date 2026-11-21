'use client';

import { useEffect, useRef } from 'react';
import { Button } from '@eguardimmo/ui';
import type { ThreadAttachment, ThreadDetail, ThreadMessage } from '../model';
import { MessageItem } from './MessageItem';

export interface MessageLogProps {
  thread: ThreadDetail;
  now: number;
  loadingEarlier: boolean;
  onLoadEarlier: () => void;
  onRedact: (message: ThreadMessage) => void;
  onDownload: (attachment: ThreadAttachment) => void;
}

export function lastReadMineId(thread: ThreadDetail): string | null {
  const readAt = thread.agencyLastReadAt === null ? null : new Date(thread.agencyLastReadAt).getTime();
  if (readAt === null) return null;
  const mine = thread.messages.filter((message) => message.mine && !message.redacted).at(-1);
  return mine !== undefined && new Date(mine.sentAt).getTime() <= readAt ? mine.id : null;
}

export function MessageLog({ thread, now, loadingEarlier, onLoadEarlier, onRedact, onDownload }: MessageLogProps) {
  const endRef = useRef<HTMLLIElement>(null);
  const lastId = thread.messages.at(-1)?.id;
  const readId = lastReadMineId(thread);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [lastId]);

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {thread.hasEarlier ? (
        <div>
          <Button variant="secondary" size="sm" loading={loadingEarlier} onClick={onLoadEarlier}>
            Voir les messages précédents
          </Button>
        </div>
      ) : null}
      <div role="log" aria-live="polite" aria-relevant="additions" aria-label="Messages de la conversation">
        <ol className="flex min-w-0 flex-col gap-3">
          {thread.messages.map((message) => (
            <MessageItem
              key={message.id}
              message={message}
              agencyName={thread.agencyName}
              readByAgency={message.id === readId}
              now={now}
              onRedact={onRedact}
              onDownload={onDownload}
            />
          ))}
          <li ref={endRef} aria-hidden="true" className="h-0" />
        </ol>
      </div>
    </div>
  );
}
