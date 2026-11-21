import { Alert, ProgressBar } from '@eguardimmo/ui';
import { READ_NOTICE, metricLabels } from '../copy';
import { failedDeliveries, pendingDeliveries } from '../model';
import type { Campaign, CampaignMetrics } from '../model';

const ORDER: (keyof typeof metricLabels)[] = ['sent', 'queued', 'sending', 'read', 'unsubscribed', 'bounced', 'failed', 'unknown', 'suppressed', 'skippedNoEmail'];

function value(metrics: CampaignMetrics, key: keyof typeof metricLabels): number {
  return metrics[key];
}

export function MetricsPanel({ campaign }: { campaign: Campaign }) {
  const { metrics, recipientCount } = campaign;
  const done = recipientCount - pendingDeliveries(metrics);
  const percent = recipientCount === 0 ? 0 : Math.round((done * 100) / recipientCount);
  const failures = failedDeliveries(metrics);
  const shown = ORDER.filter((key) => key === 'sent' || value(metrics, key) > 0);
  return (
    <section aria-label="Suivi de l’envoi" className="flex min-w-0 flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-body font-semibold text-fg">Suivi de l’envoi</h2>
        <span className="text-caption text-fg-muted">{`${String(done)} sur ${String(recipientCount)} traités`}</span>
      </div>
      <ProgressBar value={percent} label={`Avancement de l’envoi : ${String(percent)} %`} />
      {campaign.status === 'sending' ? <p className="text-caption text-fg-muted">Envoi en cours : les chiffres se mettent à jour automatiquement.</p> : null}
      <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-body sm:grid-cols-2">
        {shown.map((key) => (
          <div key={key} className="flex items-baseline justify-between gap-3 border-b border-line pb-1">
            <dt className="text-fg-muted">{metricLabels[key]}</dt>
            <dd className="font-medium text-fg">{value(metrics, key)}</dd>
          </div>
        ))}
      </dl>
      {failures > 0 ? (
        <Alert tone="warning" title={`${String(failures)} envoi${failures > 1 ? 's' : ''} en échec`}>
          Une issue inconnue n’est jamais renvoyée automatiquement : mieux vaut un e-mail manquant qu’un doublon.
        </Alert>
      ) : null}
      <p className="text-caption text-fg-subtle">{READ_NOTICE}</p>
    </section>
  );
}
