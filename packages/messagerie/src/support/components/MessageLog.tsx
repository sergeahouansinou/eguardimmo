'use client';

import { useEffect, useRef } from 'react';
import type { SupportAttachment, SupportTicketDetail } from '../model';
import { MessageItem } from './MessageItem';

export function lastReadMineId(ticket: SupportTicketDetail): string | null {
  if (ticket.supportLastReadAt === null) return null;
  const readAt = new Date(ticket.supportLastReadAt).getTime();
  const mine = ticket.messages.filter((message) => message.mine).at(-1);
  return mine !== undefined && new Date(mine.sentAt).getTime() <= readAt ? mine.id : null;
}

export function MessageLog({ ticket, onDownload }: { ticket: SupportTicketDetail; onDownload: (attachment: SupportAttachment) => void }) {
  const endRef = useRef<HTMLLIElement>(null);
  const lastId = ticket.messages.at(-1)?.id;
  const readId = lastReadMineId(ticket);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [lastId]);

  return (
    <div role="log" aria-live="polite" aria-relevant="additions" aria-label="Échanges avec le support">
      <ol className="flex min-w-0 flex-col gap-3">
        {ticket.messages.map((message) => (
          <MessageItem key={message.id} message={message} readBySupport={message.id === readId} onDownload={onDownload} />
        ))}
        <li ref={endRef} aria-hidden="true" className="h-0" />
      </ol>
    </div>
  );
}
