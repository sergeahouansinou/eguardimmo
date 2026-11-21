'use client';

import { useEffect, useRef } from 'react';
import type { SupportAttachment } from '../../model';
import { lastReadByRequesterId } from '../model';
import type { ConsoleTicketDetail } from '../model';
import { ConsoleMessageItem } from './MessageItem';

export function ConsoleMessageLog({ ticket, onDownload }: { ticket: ConsoleTicketDetail; onDownload: (attachment: SupportAttachment) => void }) {
  const endRef = useRef<HTMLLIElement>(null);
  const lastId = ticket.messages.at(-1)?.id;
  const readId = lastReadByRequesterId(ticket);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [lastId]);
  return (
    <div role="log" aria-live="polite" aria-relevant="additions" aria-label="Échanges de la demande">
      {ticket.hasMore ? <p className="pb-2 text-caption text-fg-muted">Seuls les 200 derniers messages sont affichés.</p> : null}
      <ol className="flex min-w-0 flex-col gap-3">
        {ticket.messages.map((message) => (
          <ConsoleMessageItem key={message.id} message={message} requesterName={ticket.requester.name} readByRequester={message.id === readId} onDownload={onDownload} />
        ))}
        <li ref={endRef} aria-hidden="true" className="h-0" />
      </ol>
    </div>
  );
}
