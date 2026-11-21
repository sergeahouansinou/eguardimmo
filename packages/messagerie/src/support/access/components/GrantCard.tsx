'use client';

import { Eye } from 'lucide-react';
import { Badge, Button, Icon } from '@eguardimmo/ui';
import type { BadgeTone } from '@eguardimmo/ui';
import { formatDateTime } from '../../../lib/dates';
import { basisLabel, kindLabel, scopeLabel, statusLabel } from '../copy';
import type { AccessGrant, AccessStatus } from '../model';

const statusTone: Record<AccessStatus, BadgeTone> = {
  requested: 'warning',
  active: 'success',
  refused: 'neutral',
  revoked: 'neutral',
  expired: 'neutral',
};

export interface GrantCardProps {
  grant: AccessGrant;
  busy: boolean;
  onAccept: (grant: AccessGrant) => void;
  onRefuse: (grant: AccessGrant) => void;
  onRevoke: (grant: AccessGrant) => void;
}

function timeline(grant: AccessGrant): string {
  if (grant.status === 'requested' && grant.requestedAt) return `Demandé le ${formatDateTime(grant.requestedAt)}`;
  if (grant.status === 'active' && grant.expiresAt) return `Expire le ${formatDateTime(grant.expiresAt)}`;
  if (grant.status === 'revoked' && grant.revokedAt) return `Révoqué le ${formatDateTime(grant.revokedAt)}`;
  if (grant.status === 'refused' && grant.decidedAt) return `Refusé le ${formatDateTime(grant.decidedAt)}`;
  if (grant.status === 'expired' && grant.expiresAt) return `Expiré le ${formatDateTime(grant.expiresAt)}`;
  return grant.requestedAt ? `Demandé le ${formatDateTime(grant.requestedAt)}` : '';
}

export function GrantCard({ grant, busy, onAccept, onRefuse, onRevoke }: GrantCardProps) {
  const emergency = grant.kind === 'emergency';
  const reads = `${String(grant.readCount)} lecture${grant.readCount > 1 ? 's' : ''}`;
  return (
    <li>
      <article aria-label={`${kindLabel[grant.kind]} de ${grant.operator}`} className="flex min-w-0 flex-col gap-2 rounded-lg border border-line bg-surface p-3">
        <header className="flex flex-wrap items-center gap-1.5">
          <strong className="min-w-0 text-body font-semibold break-words text-fg">{grant.operator}</strong>
          <Badge tone={emergency ? 'danger' : 'info'}>{kindLabel[grant.kind]}</Badge>
          <Badge tone={statusTone[grant.status]}>{statusLabel[grant.status]}</Badge>
          <span className="text-caption text-fg-subtle">Demande {grant.ticketReference}</span>
        </header>
        <p className="text-body break-words whitespace-pre-wrap text-fg">{grant.reason}</p>
        {emergency && grant.emergencyBasis ? <p className="text-caption text-fg-muted">Fondement : {basisLabel[grant.emergencyBasis]}</p> : null}
        <ul aria-label="Périmètre" className="flex flex-wrap gap-1.5">
          {grant.scopes.map((scope) => (
            <li key={scope}>
              <Badge>{scopeLabel[scope]}</Badge>
            </li>
          ))}
        </ul>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-fg-muted">
          <span>{timeline(grant)}</span>
          {grant.durationHours !== null ? <span>{`${String(grant.durationHours)} h`}</span> : null}
          {grant.status !== 'requested' && grant.status !== 'refused' ? (
            <span className="inline-flex items-center gap-1">
              <Icon icon={Eye} size={14} />
              {reads}
            </span>
          ) : null}
          {emergency && grant.status !== 'requested' ? <span>{grant.reviewed ? 'Revue par un second opérateur' : 'Revue par un second opérateur à venir'}</span> : null}
        </p>
        {grant.status === 'requested' ? (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={busy} onClick={() => { onAccept(grant); }}>
              Accepter
            </Button>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => { onRefuse(grant); }}>
              Refuser
            </Button>
          </div>
        ) : null}
        {grant.status === 'active' ? (
          <div>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => { onRevoke(grant); }}>
              Révoquer l’accès
            </Button>
          </div>
        ) : null}
      </article>
    </li>
  );
}
