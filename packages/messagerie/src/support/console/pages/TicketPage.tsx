'use client';

import { useEffect, useRef, useState } from 'react';
import { Alert, Badge } from '@eguardimmo/ui';
import { ErrorBlock, LoadingBlock } from '../../../components/parts';
import { categoryLabel, spaceLabel } from '../../copy';
import { consoleErrorMessage } from '../api/errors';
import { AccessPanel } from '../components/AccessPanel';
import { Composer } from '../components/Composer';
import { ConsoleMessageLog } from '../components/MessageLog';
import { ConsoleHeader, priorityTone, statusTone } from '../components/parts';
import { TicketControls } from '../components/TicketControls';
import { consoleStatusLabel, priorityLabel } from '../copy';
import { useConsoleSupportConfig } from '../context';
import { hasUnreadRequesterMessage, isUnreadForSupport } from '../model';
import type { ConsoleTicketDetail } from '../model';
import { useConsoleTicket, useDownloadConsoleAttachment, useMarkConsoleTicketRead, useUpdateConsoleTicket } from '../queries';

function TicketBody({ ticket }: { ticket: ConsoleTicketDetail }) {
  const { routes } = useConsoleSupportConfig();
  const update = useUpdateConsoleTicket(ticket.id);
  const mark = useMarkConsoleTicketRead(ticket.id);
  const download = useDownloadConsoleAttachment();
  const [failure, setFailure] = useState<string | null>(null);
  const markedFor = useRef<string | null>(null);
  const { mutate: markRead } = mark;
  const unread = isUnreadForSupport(ticket) || hasUnreadRequesterMessage(ticket);
  const marker = ticket.messages.filter((message) => !message.fromSupport).at(-1)?.id ?? ticket.updatedAt;
  useEffect(() => {
    if (!unread || markedFor.current === marker || document.visibilityState === 'hidden') return;
    markedFor.current = marker;
    markRead(undefined, { onError: () => { markedFor.current = null; } });
  }, [unread, marker, markRead]);
  const origin = ticket.organizationName ?? spaceLabel[ticket.space];
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <ConsoleHeader
        title={ticket.subject}
        subtitle={`${ticket.reference} · ${ticket.requester.name} · ${origin}`}
        breadcrumb={[{ label: 'Support', href: routes.board }, { label: ticket.reference }]}
      />
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone={statusTone[ticket.status]}>{consoleStatusLabel[ticket.status]}</Badge>
        <Badge tone={priorityTone[ticket.priority]}>{`Priorité ${priorityLabel[ticket.priority].toLowerCase()}`}</Badge>
        <Badge>{categoryLabel[ticket.category]}</Badge>
        {ticket.firstResponseOverdue ? <Badge tone="danger">Première réponse en retard</Badge> : null}
      </div>
      <TicketControls
        ticket={ticket}
        busy={update.isPending}
        onPatch={(patch) => {
          setFailure(null);
          update.mutate(patch, { onError: (error) => { setFailure(consoleErrorMessage(error)); } });
        }}
      />
      {failure ? <Alert tone="danger" title="Action impossible">{failure}</Alert> : null}
      <div className="grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-3">
          <ConsoleMessageLog
            ticket={ticket}
            onDownload={(attachment) => {
              setFailure(null);
              download.mutate(attachment, { onError: (error) => { setFailure(consoleErrorMessage(error)); } });
            }}
          />
          <Composer ticket={ticket} />
        </div>
        <AccessPanel ticket={ticket} />
      </div>
    </div>
  );
}

export function ConsoleSupportTicketPage({ ticketId }: { ticketId: string }) {
  const ticket = useConsoleTicket(ticketId);
  if (ticket.data === undefined) {
    return ticket.isError ? (
      <ErrorBlock message={consoleErrorMessage(ticket.error)} onRetry={() => { void ticket.refetch(); }} />
    ) : (
      <LoadingBlock label="Chargement de la demande" />
    );
  }
  return <TicketBody ticket={ticket.data} />;
}
