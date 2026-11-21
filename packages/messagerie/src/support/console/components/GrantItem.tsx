'use client';

import { Eye } from 'lucide-react';
import { Badge, Button, Icon } from '@eguardimmo/ui';
import type { BadgeTone } from '@eguardimmo/ui';
import { formatDateTime } from '../../../lib/dates';
import { basisLabel, kindLabel } from '../../access/copy';
import type { AccessStatus } from '../../access/model';
import { OWN_REVIEW_TEXT, grantStatusLabel, scopeReadable } from '../copy';
import { canReview, isLiveGrant, needsReview } from '../model';
import type { ConsoleGrant } from '../model';

const statusTone: Record<AccessStatus, BadgeTone> = { requested: 'warning', active: 'success', refused: 'neutral', revoked: 'neutral', expired: 'neutral' };

function timeline(grant: ConsoleGrant, live: boolean): string {
  if (grant.status === 'requested' && grant.requestedAt) return `Demandé le ${formatDateTime(grant.requestedAt)}`;
  if (grant.status === 'active' && grant.expiresAt) {
    return live ? `Accordé jusqu’au ${formatDateTime(grant.expiresAt)}` : `Expiré le ${formatDateTime(grant.expiresAt)}`;
  }
  if (grant.status === 'revoked' && grant.revokedAt) return `Révoqué le ${formatDateTime(grant.revokedAt)}`;
  if (grant.status === 'refused' && grant.decidedAt) return `Refusé le ${formatDateTime(grant.decidedAt)}`;
  if (grant.status === 'expired' && grant.expiresAt) return `Expiré le ${formatDateTime(grant.expiresAt)}`;
  return grant.requestedAt ? `Demandé le ${formatDateTime(grant.requestedAt)}` : '';
}

export interface GrantItemProps {
  grant: ConsoleGrant;
  operatorId: string | undefined;
  now: number;
  busy: boolean;
  onReview: (grant: ConsoleGrant) => void;
}

export function GrantItem({ grant, operatorId, now, busy, onReview }: GrantItemProps) {
  const emergency = grant.kind === 'emergency';
  const live = isLiveGrant(grant, now);
  const effective: AccessStatus = grant.status === 'active' && !live ? 'expired' : grant.status;
  const reads = `${String(grant.readCount)} lecture${grant.readCount > 1 ? 's' : ''}`;
  return (
    <li>
      <article aria-label={`${kindLabel[grant.kind]} de ${grant.operator.name}`} className="flex min-w-0 flex-col gap-2 rounded-lg border border-line bg-surface p-3">
        <header className="flex flex-wrap items-center gap-1.5">
          <strong className="min-w-0 text-body font-semibold break-words text-fg">{grant.operator.name}</strong>
          <Badge tone={emergency ? 'danger' : 'info'}>{kindLabel[grant.kind]}</Badge>
          <Badge tone={statusTone[effective]}>{grantStatusLabel[effective]}</Badge>
        </header>
        <p className="text-body break-words whitespace-pre-wrap text-fg">{grant.reason}</p>
        {emergency && grant.emergencyBasis ? <p className="text-caption text-fg-muted">Fondement : {basisLabel[grant.emergencyBasis]}</p> : null}
        <ul aria-label="Périmètre" className="flex flex-wrap gap-1.5">
          {grant.scopes.map((scope) => (
            <li key={scope}>
              <Badge>{scopeReadable[scope]}</Badge>
            </li>
          ))}
        </ul>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-fg-muted">
          <span>{timeline(grant, live)}</span>
          {grant.durationHours !== null ? <span>{`${String(grant.durationHours)} h`}</span> : null}
          {grant.status !== 'requested' && grant.status !== 'refused' ? (
            <span className="inline-flex items-center gap-1">
              <Icon icon={Eye} size={14} />
              {reads}
            </span>
          ) : null}
        </p>
        {emergency && grant.status !== 'requested' ? (
          <p className="text-caption text-fg-muted">
            {grant.reviewed ? `Revue par un autre opérateur${grant.reviewedAt ? ` le ${formatDateTime(grant.reviewedAt)}` : ''}.` : 'Revue par un second opérateur en attente.'}
          </p>
        ) : null}
        {needsReview(grant) && canReview(grant, operatorId) ? (
          <div>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => { onReview(grant); }}>
              Revoir cet accès d’urgence
            </Button>
          </div>
        ) : null}
        {needsReview(grant) && operatorId !== undefined && grant.operator.id === operatorId ? <p className="text-caption text-fg-muted">{OWN_REVIEW_TEXT}</p> : null}
      </article>
    </li>
  );
}
