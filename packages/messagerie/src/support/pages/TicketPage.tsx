'use client';

import { useEffect, useRef, useState } from 'react';
import { Alert, Badge } from '@eguardimmo/ui';
import { ErrorBlock, LoadingBlock } from '../../components/parts';
import { supportErrorMessage } from '../api/errors';
import { MessageLog } from '../components/MessageLog';
import { AvailabilityLine, SupportHeader } from '../components/parts';
import { ReplyForm } from '../components/ReplyForm';
import { statusTone } from '../components/TicketRow';
import { categoryLabel, statusLabel } from '../copy';
import { useSupportConfig } from '../context';
import type { SupportTicketDetail } from '../model';
import { useDownloadSupportAttachment, useMarkSupportTicketRead, useSupportTicket } from '../queries';

function unreadMarker(ticket: SupportTicketDetail): string | null {
  const last = ticket.messages.filter((message) => message.fromSupport).at(-1);
  if (last === undefined) return null;
  const readAt = ticket.requesterLastReadAt === null ? null : new Date(ticket.requesterLastReadAt).getTime();
  return readAt === null || new Date(last.sentAt).getTime() > readAt ? last.id : null;
}

function TicketBody({ ticket }: { ticket: SupportTicketDetail }) {
  const { routes, seen } = useSupportConfig();
  const mark = useMarkSupportTicketRead();
  const download = useDownloadSupportAttachment();
  const [failure, setFailure] = useState<string | null>(null);
  const markedFor = useRef<string | null>(null);
  const { mutate: markRead } = mark;
  const pendingRead = unreadMarker(ticket);
  const { id, updatedAt } = ticket;

  useEffect(() => {
    if (pendingRead === null) {
      seen.mark(id, updatedAt);
      return;
    }
    if (markedFor.current === pendingRead || document.visibilityState === 'hidden') return;
    markedFor.current = pendingRead;
    markRead({ id, updatedAt }, { onError: () => { markedFor.current = null; } });
  }, [pendingRead, id, updatedAt, seen, markRead]);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <SupportHeader
        title={ticket.subject}
        subtitle={ticket.reference}
        breadcrumb={[{ label: 'Mes demandes au support', href: routes.board }, { label: ticket.reference }]}
      />
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone={statusTone[ticket.status]}>{statusLabel[ticket.status]}</Badge>
        <Badge>{categoryLabel[ticket.category]}</Badge>
        {ticket.handled ? <Badge tone="info">Prise en charge</Badge> : null}
      </div>
      <AvailabilityLine />
      {failure ? <Alert tone="danger" title="Action impossible">{failure}</Alert> : null}
      <div className="flex max-w-3xl min-w-0 flex-col gap-3">
        <MessageLog
          ticket={ticket}
          onDownload={(attachment) => {
            setFailure(null);
            download.mutate(attachment, { onError: (error) => { setFailure(supportErrorMessage(error)); } });
          }}
        />
        <ReplyForm ticketId={ticket.id} status={ticket.status} />
      </div>
    </div>
  );
}

export function SupportTicketPage({ ticketId }: { ticketId: string }) {
  const ticket = useSupportTicket(ticketId);
  if (ticket.data === undefined) {
    return ticket.isError ? (
      <ErrorBlock message={supportErrorMessage(ticket.error)} onRetry={() => { void ticket.refetch(); }} />
    ) : (
      <LoadingBlock label="Chargement de la demande" />
    );
  }
  return <TicketBody ticket={ticket.data} />;
}
