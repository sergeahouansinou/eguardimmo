"use client";

import { Alert, Badge, Button, ConfirmDialog } from "@eguardimmo/ui";
import { useOrganizationSession } from "@eguardimmo/shell";
import { KeyRound, UserRound } from "lucide-react";
import { useState } from "react";
import { ListRow } from "@/components/ui/ListRow";
import { SectionCard } from "@/components/ui/SectionCard";
import { formatDay } from "@/lib/dates";
import { describeOwnerAccessFailure } from "./errors";
import { InviteOwnerDialog } from "./InviteOwnerDialog";
import { OWNER_ROLE_LABELS } from "./labels";
import type { MandantKind } from "./labels";
import { useOwnerAccessState, useRevokeOwnerAccess } from "./queries";

interface RevokeTarget {
  id: string;
  label: string;
  pending: boolean;
}

export interface OwnerAccessSectionProps {
  partyId: string;
  mandantName: string;
  mandantKind: MandantKind;
  canWrite: boolean;
}

export function OwnerAccessSection({ partyId, mandantName, mandantKind, canWrite }: OwnerAccessSectionProps) {
  const session = useOrganizationSession();
  const state = useOwnerAccessState(partyId);
  const revoke = useRevokeOwnerAccess(partyId);
  const [inviting, setInviting] = useState(false);
  const [target, setTarget] = useState<RevokeTarget | null>(null);
  const [revoked, setRevoked] = useState<string | null>(null);
  if (session === null) return null;

  const confirmRevoke = () => {
    if (target === null) return;
    const done = target.pending ? "Invitation retirée" : "Accès retiré";
    revoke.reset();
    setRevoked(null);
    revoke.mutate(target.id, {
      onSuccess: () => { setRevoked(done); },
      onSettled: () => { setTarget(null); },
    });
  };
  const revokeFailure = revoke.isError ? describeOwnerAccessFailure(revoke.error) : null;
  const entries = state.data ? state.data.accesses.length + state.data.invitations.length : 0;

  return (
    <SectionCard
      title="Espace propriétaire"
      action={canWrite ? <Button variant="secondary" size="sm" onClick={() => { setInviting(true); }}><KeyRound aria-hidden className="size-3.5" />Inviter à l’espace propriétaire</Button> : undefined}
    >
      {revoked ? <Alert tone="success" title={revoked}>{`La liste de ${mandantName} est à jour.`}</Alert> : null}
      {revokeFailure ? <Alert tone="danger" title="Retrait impossible">{revokeFailure.message}</Alert> : null}
      {state.data === undefined ? (
        state.isError ? (
          <Alert tone="danger" title="L’accès propriétaire n’a pas pu être chargé">
            <span className="flex flex-wrap items-center gap-2">
              {describeOwnerAccessFailure(state.error).message}
              <Button variant="link" size="sm" onClick={() => { void state.refetch(); }}>Réessayer</Button>
            </span>
          </Alert>
        ) : (
          <p role="status" className="py-2 text-body text-fg-subtle">Chargement de l’accès propriétaire…</p>
        )
      ) : entries === 0 ? (
        <p role="note" className="py-2 text-body text-fg-subtle">Aucun compte n’est rattaché à ce mandant. Invitez-le pour qu’il consulte son espace propriétaire.</p>
      ) : (
        <div role="list" aria-label="Accès propriétaire du mandant">
          {state.data.accesses.map((access) => (
            <div role="listitem" key={access.id}>
              <ListRow
                icon={UserRound}
                tone="success"
                title={`${OWNER_ROLE_LABELS[access.role]} · ${access.email_hint ?? "adresse non communiquée"}`}
                caption={`Compte rattaché le ${formatDay(access.linked_at.slice(0, 10))}`}
                trailing={canWrite ? <RevokeButton label={`Retirer l’accès de ${access.email_hint ?? OWNER_ROLE_LABELS[access.role]}`} onClick={() => { setTarget({ id: access.id, label: access.email_hint ?? OWNER_ROLE_LABELS[access.role], pending: false }); }} /> : undefined}
              />
            </div>
          ))}
          {state.data.invitations.map((invitation) => (
            <div role="listitem" key={invitation.id}>
              <ListRow
                icon={KeyRound}
                tone="warning"
                title={`${OWNER_ROLE_LABELS[invitation.role]} · ${invitation.email_hint ?? "adresse non communiquée"}`}
                caption={`Invitation en attente, valable jusqu’au ${formatDay(invitation.expires_at.slice(0, 10))} · ${String(invitation.attempts_remaining)} essais restants`}
                trailing={
                  <>
                    <Badge tone="warning">En attente</Badge>
                    {canWrite ? <RevokeButton label={`Retirer l’invitation de ${invitation.email_hint ?? OWNER_ROLE_LABELS[invitation.role]}`} onClick={() => { setTarget({ id: invitation.id, label: invitation.email_hint ?? OWNER_ROLE_LABELS[invitation.role], pending: true }); }} /> : null}
                  </>
                }
              />
            </div>
          ))}
        </div>
      )}
      {canWrite ? (
        <InviteOwnerDialog
          open={inviting}
          onOpenChange={(open) => {
            setInviting(open);
            if (open) setRevoked(null);
          }}
          partyId={partyId}
          mandantName={mandantName}
          mandantKind={mandantKind}
        />
      ) : null}
      <ConfirmDialog
        open={target !== null}
        onOpenChange={(open) => { if (!open) setTarget(null); }}
        title={target?.pending ? "Retirer cette invitation ?" : "Retirer cet accès ?"}
        description={target ? `${target.label} ${target.pending ? "ne pourra plus utiliser cette invitation" : "perdra immédiatement l’accès à l’espace propriétaire de " + mandantName}.` : ""}
        confirmLabel="Retirer"
        tone="danger"
        loading={revoke.isPending}
        onConfirm={confirmRevoke}
      />
    </SectionCard>
  );
}

function RevokeButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button variant="ghost" size="sm" aria-label={label} onClick={onClick}>
      Retirer
    </Button>
  );
}
