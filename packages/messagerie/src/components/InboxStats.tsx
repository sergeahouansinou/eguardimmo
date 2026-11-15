'use client';

import { Clock, Mail, TriangleAlert } from 'lucide-react';
import { StatCard } from '@eguardimmo/ui';
import { useInboxStats } from '../data/queries';
import { participantRoleSchema } from '../data/schemas';
import { ErrorBlock, LoadingBlock, roleLabels } from './parts';

export function InboxStats() {
  const stats = useInboxStats();
  if (stats.data === undefined) {
    return stats.isError ? (
      <ErrorBlock message="Impossible de charger les indicateurs." onRetry={stats.refetch} />
    ) : (
      <LoadingBlock label="Chargement des indicateurs" />
    );
  }
  const data = stats.data;
  const byRole = participantRoleSchema.options
    .flatMap((role) => {
      const count = data.unreadByRole[role];
      return count === undefined || count === 0 ? [] : [`${String(count)} ${roleLabels[role].toLowerCase()}`];
    })
    .join(', ');
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <StatCard label="Messages non lus" value={data.unread} icon={Mail}>
        {byRole ? <span className="text-caption text-fg-subtle">{byRole}</span> : null}
      </StatCard>
      <StatCard label="Sans réponse" value={data.stale.count} icon={TriangleAlert} tone={data.stale.count > 0 ? 'danger' : 'default'}>
        {data.stale.detail ? <span className="text-caption text-fg-subtle">{data.stale.detail}</span> : null}
      </StatCard>
      <StatCard label="Délai moyen de réponse" value={data.averageReplyLabel} icon={Clock} />
    </div>
  );
}
