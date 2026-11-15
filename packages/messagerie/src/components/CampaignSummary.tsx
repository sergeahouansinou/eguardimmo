import type { ResolvedAudience } from '../data/audience';
import { formatDateTime, localValueToIso } from '../lib/dates';

export interface CampaignSummaryProps {
  resolved: ResolvedAudience | null;
  noun: string;
  senderName: string | null;
  mode: 'now' | 'scheduled';
  scheduledAt: string;
}

export function CampaignSummary({ resolved, noun, senderName, mode, scheduledAt }: CampaignSummaryProps) {
  const reached = resolved && resolved.count > 0 ? resolved : null;
  let when = 'Tout de suite';
  if (mode === 'scheduled') when = scheduledAt ? formatDateTime(localValueToIso(scheduledAt)) : 'À programmer';
  return (
    <section aria-label="Récapitulatif" className="flex flex-col gap-2 rounded-md bg-muted px-3 py-2 text-body text-fg-muted">
      <p>
        {reached ? `${String(reached.count)} ${noun} · ${reached.label}` : 'Aucun destinataire choisi'}
        {senderName ? ` · Expéditeur : ${senderName}` : ''}
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-caption">
        <dt className="text-fg-subtle">Canal</dt>
        <dd className="text-fg">E-mail</dd>
        <dt className="text-fg-subtle">Destinataires</dt>
        <dd className="text-fg">{reached ? `${String(reached.count - reached.withoutEmail)} sur ${String(reached.count)}` : '—'}</dd>
        <dt className="text-fg-subtle">Envoi</dt>
        <dd className="text-fg">{when}</dd>
      </dl>
    </section>
  );
}
