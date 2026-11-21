'use client';

import { useEffect, useRef } from 'react';
import { Button } from '@eguardimmo/ui';
import type { ThreadAttachment } from '../../model';
import type { StaffMessage, StaffThreadDetail } from '../model';
import { StaffMessageItem, canRedactMessage } from './MessageItem';

export interface StaffMessageLogProps {
  thread: StaffThreadDetail;
  now: number;
  administer: boolean;
  loadingEarlier: boolean;
  onLoadEarlier: () => void;
  onRedact: (message: StaffMessage) => void;
  onDownload: (attachment: ThreadAttachment) => void;
}

export function lastReadStaffId(thread: StaffThreadDetail): string | null {
  if (thread.counterpartLastReadAt === null) return null;
  const readAt = new Date(thread.counterpartLastReadAt).getTime();
  const last = thread.messages.filter((message) => message.side === 'staff' && !message.redacted).at(-1);
  return last !== undefined && new Date(last.sentAt).getTime() <= readAt ? last.id : null;
}

export function StaffMessageLog({ thread, now, administer, loadingEarlier, onLoadEarlier, onRedact, onDownload }: StaffMessageLogProps) {
  const endRef = useRef<HTMLLIElement>(null);
  const lastId = thread.messages.at(-1)?.id;
  const readId = lastReadStaffId(thread);

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
            <StaffMessageItem
              key={message.id}
              message={message}
              kind={thread.kind}
              readByCounterpart={message.id === readId}
              redactable={canRedactMessage(message, administer, now)}
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
