'use client';

import { ArrowLeft } from 'lucide-react';
import { Badge, Button, Icon } from '@eguardimmo/ui';
import { useMyTicket, useMyTickets, useReplyToMyTicket } from '../data/queries';
import { formatDayMonthTime } from '../lib/dates';
import { Composer } from './Composer';
import { ConversationThread } from './ConversationThread';
import { EmptyBlock, ErrorBlock, LoadingBlock } from './parts';
import { statusLabels, statusTones } from './ticketMeta';

export function MyTicketList({ onOpen, onContact }: { onOpen: (ticketId: string) => void; onContact?: () => void }) {
  const tickets = useMyTickets();
  if (tickets.data === undefined) {
    return tickets.isError ? (
      <ErrorBlock message="Impossible de charger vos demandes." onRetry={tickets.refetch} />
    ) : (
      <LoadingBlock label="Chargement de vos demandes" />
    );
  }
  if (tickets.data.length === 0) {
    return (
      <EmptyBlock
        title="Aucune demande pour le moment"
        hint="Vos demandes au support apparaîtront ici avec leur statut."
        action={onContact ? <Button onClick={onContact}>Contacter le support</Button> : undefined}
      />
    );
  }
  return (
    <ul aria-label="Mes demandes" className="overflow-hidden rounded-lg border border-line bg-surface">
      {tickets.data.map((ticket) => (
        <li key={ticket.id} className="border-b border-line last:border-b-0">
          <button
            type="button"
            onClick={() => { onOpen(ticket.id); }}
            className="flex w-full min-w-0 flex-col gap-1 px-3 py-2.5 text-left hover:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
          >
            <span className="flex min-w-0 items-baseline justify-between gap-2">
              <span className="min-w-0 truncate text-body font-medium text-fg">{ticket.subject}</span>
              <time dateTime={ticket.updatedAt} className="shrink-0 text-caption text-fg-subtle">
                {formatDayMonthTime(ticket.updatedAt)}
              </time>
            </span>
            <span className="flex items-center gap-2 text-caption text-fg-muted">
              {ticket.reference}
              <Badge tone={statusTones[ticket.status]}>{statusLabels[ticket.status]}</Badge>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function MyTicketThread({ ticketId, onBack }: { ticketId: string; onBack: () => void }) {
  const ticket = useMyTicket(ticketId);
  const reply = useReplyToMyTicket(ticketId);
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <Button variant="ghost" size="sm" className="w-fit" onClick={onBack}>
        <Icon icon={ArrowLeft} />
        Mes demandes
      </Button>
      {ticket.data === undefined || ticket.data === null ? (
        ticket.isError ? (
          <ErrorBlock message="Demande introuvable." onRetry={ticket.refetch} />
        ) : (
          <LoadingBlock label="Chargement de la demande" />
        )
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="min-w-0 text-block-title text-fg">{ticket.data.subject}</h3>
            <Badge tone={statusTones[ticket.data.status]}>{statusLabels[ticket.data.status]}</Badge>
            <span className="text-caption text-fg-subtle">{ticket.data.reference}</span>
          </div>
          <ConversationThread
            messages={ticket.data.messages}
            participants={ticket.data.participants}
            viewerId={ticket.data.viewerId}
            label="Échanges avec le support"
          />
          <Composer
            label="Votre message"
            placeholder="Ex. Merci, j’ai bien reçu la quittance."
            submitLabel="Répondre"
            onSend={reply.mutateAsync}
          />
        </>
      )}
    </div>
  );
}
