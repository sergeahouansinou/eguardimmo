'use client';

import { CircleCheck, Clock, RotateCcw, UserRoundPlus } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardTitle,
  Icon,
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
  Select,
} from '@eguardimmo/ui';
import { useMessagerieConfig } from '../config';
import type { TicketPatch } from '../data/inputs';
import { useReplyToTicket, useStaff, useTicket, useUpdateTicket } from '../data/queries';
import { useMessagerieSource } from '../data/source';
import { ticketPrioritySchema } from '../data/schemas';
import type { Attachment, TicketDetail as TicketDetailData } from '../data/schemas';
import { formatDateTime } from '../lib/dates';
import { errorMessage } from '../lib/errors';
import { Composer } from './Composer';
import { ConversationThread } from './ConversationThread';
import { TicketAccessDialog } from './TicketAccessDialog';
import { ErrorBlock, LoadingBlock, PageHeader } from './parts';
import { categoryLabels, priorityLabels, priorityTones, statusLabels, statusTones } from './ticketMeta';

const priorityOptions = ticketPrioritySchema.options.map((value) => ({ value, label: priorityLabels[value] }));

const linkedTones: Record<TicketDetailData['linked'][number]['tone'], string> = {
  neutral: 'text-fg-subtle',
  warning: 'text-warning-fg',
  info: 'text-info-fg',
};

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-body">
      <dt className="shrink-0 text-fg-subtle">{label}</dt>
      <dd className="min-w-0 text-right text-fg">{children}</dd>
    </div>
  );
}

function TicketDetailBody({ ticket }: { ticket: TicketDetailData }) {
  const { routes } = useMessagerieConfig();
  const staff = useStaff();
  const update = useUpdateTicket(ticket.id);
  const reply = useReplyToTicket(ticket.id);
  const { downloadTicketAttachment } = useMessagerieSource();
  const [notice, setNotice] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const apply = (patch: TicketPatch, message: string) => {
    setNotice(null);
    setFailure(null);
    update.mutate(patch, {
      onSuccess: () => { setNotice(message); },
      onError: (error) => { setFailure(errorMessage(error)); },
    });
  };

  const openAttachment = downloadTicketAttachment
    ? (attachment: Attachment) => {
        setFailure(null);
        downloadTicketAttachment(attachment).catch((error: unknown) => { setFailure(errorMessage(error)); });
      }
    : undefined;

  const resolved = ticket.status === 'resolu';

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader
        title={ticket.subject}
        subtitle={`${ticket.reference} · ${ticket.organization}`}
        breadcrumb={[{ label: 'Support', href: routes.supportBoard }, { label: ticket.reference }]}
        actions={
          <>
            <Menu>
              <MenuTrigger asChild>
                <Button variant="secondary">
                  <Icon icon={UserRoundPlus} />
                  {ticket.assigneeName ? `Assigné à ${ticket.assigneeName}` : 'Assigner'}
                </Button>
              </MenuTrigger>
              <MenuContent>
                <MenuLabel>Assigner à</MenuLabel>
                {(staff.data ?? []).map((member) => (
                  <MenuItem
                    key={member.id}
                    onSelect={() => { apply({ assigneeId: member.id }, `Ticket assigné à ${member.name}.`); }}
                  >
                    {member.name}
                  </MenuItem>
                ))}
                <MenuSeparator />
                <MenuItem onSelect={() => { apply({ assigneeId: null }, 'Ticket désassigné.'); }}>Retirer l’assignation</MenuItem>
              </MenuContent>
            </Menu>
            {resolved ? (
              <Button variant="secondary" loading={update.isPending} onClick={() => { apply({ status: 'ouvert' }, 'Ticket rouvert.'); }}>
                <Icon icon={RotateCcw} />
                Rouvrir
              </Button>
            ) : (
              <>
                {ticket.status === 'ouvert' ? (
                  <Button
                    variant="secondary"
                    loading={update.isPending}
                    onClick={() => { apply({ status: 'en_attente' }, 'Ticket mis en attente du client.'); }}
                  >
                    <Icon icon={Clock} />
                    Marquer en attente
                  </Button>
                ) : null}
                <Button loading={update.isPending} onClick={() => { apply({ status: 'resolu' }, 'Ticket marqué comme résolu.'); }}>
                  <Icon icon={CircleCheck} />
                  Marquer résolu
                </Button>
              </>
            )}
          </>
        }
      />
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone={statusTones[ticket.status]}>{statusLabels[ticket.status]}</Badge>
        <Badge tone={priorityTones[ticket.priority]}>Priorité {priorityLabels[ticket.priority].toLowerCase()}</Badge>
        <Badge>{categoryLabels[ticket.category]}</Badge>
      </div>
      {notice ? <Alert tone="success">{notice}</Alert> : null}
      {failure ? <Alert tone="danger" title="Action impossible">{failure}</Alert> : null}
      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-3">
          <ConversationThread
            messages={ticket.messages}
            participants={ticket.participants}
            viewerId={ticket.viewerId}
            label="Échanges du ticket"
            {...(openAttachment ? { onOpenAttachment: openAttachment } : {})}
          />
          <Composer
            allowInternal
            label="Votre réponse"
            placeholder="Ex. Bonjour, nous avons identifié le problème et le corrigeons."
            submitLabel="Répondre"
            onSend={reply.mutateAsync}
          />
        </div>
        <aside aria-label="Informations du ticket" className="flex min-w-0 flex-col gap-3">
          <Card>
            <CardTitle as="h2">Informations</CardTitle>
            <dl className="flex flex-col gap-2">
              <InfoRow label="Demandeur">{ticket.requester.name}</InfoRow>
              <InfoRow label="Organisation">{ticket.organization}</InfoRow>
              <InfoRow label="Créé le">{formatDateTime(ticket.createdAt)}</InfoRow>
              <InfoRow label="Première réponse">{ticket.firstResponseLabel ?? 'En attente'}</InfoRow>
            </dl>
            <Select
              label="Priorité"
              placeholder="Choisir une priorité"
              options={priorityOptions}
              value={ticket.priority}
              disabled={update.isPending}
              onValueChange={(value) => {
                const parsed = ticketPrioritySchema.safeParse(value);
                if (parsed.success && parsed.data !== ticket.priority) {
                  apply({ priority: parsed.data }, `Priorité ${priorityLabels[parsed.data].toLowerCase()} enregistrée.`);
                }
              }}
            />
          </Card>
          <Card>
            <CardTitle as="h2">Accès justifié</CardTitle>
            {ticket.access ? (
              <Alert tone="info" title="Accès ouvert">
                Jusqu’à {formatDateTime(ticket.access.expiresAt)}. Motif : {ticket.access.reason}
              </Alert>
            ) : (
              <p className="text-body text-fg-muted">Aucun accès ouvert aux données de cette organisation.</p>
            )}
            <TicketAccessDialog ticketId={ticket.id} onGranted={() => { setNotice('Accès justifié ouvert pour 60 minutes.'); }} />
          </Card>
          {ticket.linked.length > 0 ? (
            <Card>
              <CardTitle as="h2">Éléments liés</CardTitle>
              <ul className="flex flex-col gap-2">
                {ticket.linked.map((item) => (
                  <li key={item.id} className="flex flex-col text-body">
                    <span className="text-fg">{item.label}</span>
                    <span className={`text-caption ${linkedTones[item.tone]}`}>{item.detail}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

export function TicketDetail({ ticketId }: { ticketId: string }) {
  const ticket = useTicket(ticketId);
  if (ticket.data === undefined) {
    return ticket.isError ? (
      <ErrorBlock message="Ticket introuvable ou inaccessible." onRetry={ticket.refetch} />
    ) : (
      <LoadingBlock label="Chargement du ticket" />
    );
  }
  return <TicketDetailBody ticket={ticket.data} />;
}
