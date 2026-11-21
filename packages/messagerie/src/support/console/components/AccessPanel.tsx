'use client';

import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Alert, Button, ConfirmDialog, Icon } from '@eguardimmo/ui';
import { useNow } from '../../../external/components/parts';
import { consoleErrorMessage } from '../api/errors';
import { liveGrantsOf, openGrantOf } from '../model';
import type { ConsoleGrant, ConsoleTicketDetail } from '../model';
import { useOperatorId, useReviewGrant } from '../queries';
import { EmergencyDialog } from './EmergencyDialog';
import { GrantItem } from './GrantItem';
import { OrganizationReads } from './OrganizationReads';
import { PrivacyNote } from './parts';
import { RequestAccessDialog } from './RequestAccessDialog';

const CLOCK_MS = 15_000;

export function AccessPanel({ ticket }: { ticket: ConsoleTicketDetail }) {
  const operatorId = useOperatorId();
  const now = useNow(CLOCK_MS);
  const review = useReviewGrant(ticket.id);
  const [requesting, setRequesting] = useState(false);
  const [emergency, setEmergency] = useState(false);
  const [toReview, setToReview] = useState<ConsoleGrant | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const organizationId = ticket.organizationId;
  const open = openGrantOf(ticket, now);
  const resolved = ticket.status === 'resolved';
  const blocked = resolved || open !== undefined;
  const reason = resolved
    ? 'La demande est résolue : les accès sont terminés et ne peuvent plus être demandés.'
    : open
      ? 'Un accès est déjà demandé ou en cours pour cette demande.'
      : null;
  return (
    <section aria-label="Accès aux données de l’organisation" className="flex min-w-0 flex-col gap-3 rounded-lg border border-line bg-surface p-3">
      <h2 className="flex items-center gap-1.5 text-block-title font-semibold text-fg">
        <Icon icon={ShieldCheck} />
        Accès aux données de l’organisation
      </h2>
      <PrivacyNote />
      {organizationId === null ? (
        <Alert tone="info">Cette demande n’est rattachée à aucune organisation : il n’y a pas d’accès à demander.</Alert>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={blocked} onClick={() => { setRequesting(true); }}>
              Demander l’accès
            </Button>
            <Button size="sm" variant="danger" disabled={blocked} onClick={() => { setEmergency(true); }}>
              <Icon icon={ShieldAlert} />
              Ouvrir un accès d’urgence
            </Button>
          </div>
          {reason ? <p className="text-caption text-fg-muted">{reason}</p> : null}
          {failure ? <Alert tone="danger" title="Revue impossible">{failure}</Alert> : null}
          <div aria-live="polite">
            {ticket.grants.length === 0 ? (
              <p className="text-body text-fg-muted">Aucun accès n’a été demandé pour cette demande.</p>
            ) : (
              <ul aria-label="Accès de cette demande" className="flex flex-col gap-2">
                {ticket.grants.map((grant) => (
                  <GrantItem key={grant.id} grant={grant} operatorId={operatorId} now={now} busy={review.isPending} onReview={(item) => { setFailure(null); setToReview(item); }} />
                ))}
              </ul>
            )}
          </div>
          <OrganizationReads organizationId={organizationId} liveGrants={liveGrantsOf(ticket, operatorId, now)} />
          <RequestAccessDialog ticketId={ticket.id} organizationName={ticket.organizationName} open={requesting} onClose={() => { setRequesting(false); }} />
          <EmergencyDialog ticketId={ticket.id} organizationName={ticket.organizationName} open={emergency} onClose={() => { setEmergency(false); }} />
          <ConfirmDialog
            open={toReview !== null}
            onOpenChange={(next) => { if (!next) setToReview(null); }}
            title="Confirmer la revue de l’accès d’urgence ?"
            description={`Vous attestez avoir examiné l’accès d’urgence ouvert par ${toReview?.operator.name ?? 'un opérateur'} : motif, fondement et lectures.`}
            confirmLabel="Confirmer la revue"
            loading={review.isPending}
            onConfirm={() => {
              if (toReview === null) return;
              review.mutate(toReview.id, {
                onError: (error) => { setFailure(consoleErrorMessage(error)); },
                onSettled: () => { setToReview(null); },
              });
            }}
          />
        </>
      )}
    </section>
  );
}
