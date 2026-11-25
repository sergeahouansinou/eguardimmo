'use client';

import { Badge, Button, StatCard } from '@eguardimmo/ui';
import Link from 'next/link';
import { formatDateTime, formatInteger } from '@/lib/format';
import type { CampaignDetail, CampaignStats } from '@/platform/marketing/marketing';
import { PageHeader } from '@/ui/PageHeader';
import { KeyValueList, Section } from '@/ui/Section';
import { EmailPreview } from './editor/EmailPreview';
import { PushPreview } from './editor/PushPreview';
import { CATEGORY_LABELS, CHANNEL_LABELS, STATUS_LABELS, STATUS_TONES, formatBytes } from './labels';
import { useImageSources } from './useImageSources';

function statistics(stats: CampaignStats): { label: string; value: number }[] {
  return [
    { label: 'En attente', value: stats.queued + stats.sending },
    { label: 'Envoyés', value: stats.sent },
    { label: 'Échecs', value: stats.failed },
    { label: 'Rejetés par la messagerie', value: stats.bounced },
    { label: 'Écartés (sans accord ou opposition)', value: stats.suppressed },
    { label: 'Sans appareil', value: stats.skipped_no_device },
    { label: 'Sans adresse e-mail', value: stats.skipped_no_email },
    { label: 'Issue inconnue', value: stats.unknown },
    { label: 'Désinscriptions', value: stats.unsubscribed },
  ];
}

function EmailContent({ campaign }: { campaign: CampaignDetail }) {
  const sources = useImageSources(campaign.images);
  return (
    <div className="flex min-w-0 flex-col gap-3 py-2">
      <EmailPreview subject={campaign.subject ?? ''} html={campaign.html ?? ''} sources={sources} />
      {campaign.images.length > 0 ? (
        <ul aria-label="Images de la campagne" className="flex flex-col gap-1 text-body">
          {campaign.images.map((image) => (
            <li key={image.id} className="break-all">
              {image.name} · {formatBytes(image.size)} · {image.inline ? 'insérée dans le texte' : 'en pièce jointe'}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function CampaignDetailView({ campaign, onRefresh }: { campaign: CampaignDetail; onRefresh: () => void }) {
  const title = campaign.title || 'Campagne sans titre';
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader
        Link={Link}
        title={title}
        badges={<Badge tone={STATUS_TONES[campaign.status]}>{STATUS_LABELS[campaign.status]}</Badge>}
        breadcrumb={[{ label: 'Vue d’ensemble', href: '/' }, { label: 'Marketing', href: '/marketing' }, { label: title }]}
        actions={<Button variant="secondary" onClick={onRefresh}>Actualiser</Button>}
      />
      <Section id="campaign-stats" title="Statistiques">
        <div className="grid grid-cols-2 gap-2 py-2 md:grid-cols-5">
          <StatCard label="Destinataires" value={formatInteger(campaign.recipient_count)} />
          {statistics(campaign.stats).map((entry) => <StatCard key={entry.label} label={entry.label} value={formatInteger(entry.value)} />)}
        </div>
      </Section>
      <Section id="campaign-summary" title="Envoi">
        <div className="py-2">
          <KeyValueList
            items={[
              { label: 'Canal', value: CHANNEL_LABELS[campaign.channel] },
              { label: 'Catégorie', value: CATEGORY_LABELS[campaign.category] },
              { label: 'Destinataires', value: campaign.audience_label },
              ...(campaign.inactivity_days === null ? [] : [{ label: 'Inactivité', value: `${formatInteger(campaign.inactivity_days)} jours` }]),
              ...(campaign.recipient_emails.length === 0 ? [] : [{ label: 'Adresses', value: campaign.recipient_emails.join(', ') }]),
              { label: 'Créée le', value: formatDateTime(campaign.created_at) },
              { label: 'Envoyée le', value: campaign.sent_at === null ? 'Envoi en cours' : formatDateTime(campaign.sent_at) },
            ]}
          />
        </div>
      </Section>
      <Section id="campaign-content" title="Contenu">
        {campaign.channel === 'email' ? (
          <EmailContent campaign={campaign} />
        ) : (
          <div className="py-2">
            <PushPreview title={campaign.push_title ?? ''} body={campaign.push_body ?? ''} link={campaign.link ?? ''} />
          </div>
        )}
      </Section>
    </div>
  );
}
