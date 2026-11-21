'use client';

import { StatCard } from '@eguardimmo/ui';
import { formatDelay } from '../../../data/api/shared';
import { consoleErrorMessage } from '../api/errors';
import { useConsoleStats } from '../queries';

export function StatsStrip() {
  const stats = useConsoleStats();
  if (stats.data === undefined) {
    return stats.isError ? <p role="status" className="text-caption text-fg-muted">{`Indicateurs indisponibles : ${consoleErrorMessage(stats.error)}`}</p> : null;
  }
  const { open, openHigh, waiting, resolved30d, firstResponseMinutes, firstResponseOverdue } = stats.data;
  return (
    <section aria-label="Indicateurs du support" className="grid grid-cols-2 gap-3 md:grid-cols-5">
      <StatCard label="Ouvertes" value={open}>
        <span className="text-caption text-fg-subtle">{`dont ${String(openHigh)} en priorité haute`}</span>
      </StatCard>
      <StatCard label="En attente du demandeur" value={waiting} />
      <StatCard label="Résolues sur 30 jours" value={resolved30d} />
      <StatCard label="Première réponse (médiane)" value={firstResponseMinutes === null ? '—' : formatDelay(firstResponseMinutes)}>
        <span className="text-caption text-fg-subtle">{firstResponseMinutes === null ? 'Aucune réponse sur 30 jours' : 'Sur 30 jours'}</span>
      </StatCard>
      <StatCard label="Première réponse en retard" value={firstResponseOverdue} tone={firstResponseOverdue > 0 ? 'danger' : 'default'} />
    </section>
  );
}
