'use client';

import { Alert, Button } from '@eguardimmo/ui';
import Link from 'next/link';
import { PageHeader } from '@/ui/PageHeader';
import { Section } from '@/ui/Section';
import { AudienceFields } from './AudienceFields';
import { CampaignActions } from './CampaignActions';
import { ChannelFields } from './ChannelFields';
import { EmailFields } from './EmailFields';
import { PushFields } from './PushFields';
import { useCampaignForm } from './useCampaignForm';
import type { CampaignFormSetup } from './useCampaignForm';

export function CampaignEditor(setup: CampaignFormSetup) {
  const { options } = setup;
  const form = useCampaignForm(setup);
  const { saved, draft, errors, failure } = form;
  const title = saved === null ? 'Nouvelle campagne' : saved.title || 'Campagne sans titre';

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader
        Link={Link}
        title={title}
        subtitle={saved === null ? 'Préparez le message, puis enregistrez-le pour le tester et l’envoyer.' : 'Brouillon'}
        breadcrumb={[{ label: 'Vue d’ensemble', href: '/' }, { label: 'Marketing', href: '/marketing' }, { label: title }]}
      />
      <fieldset disabled={form.saving || form.reloading} className="flex min-w-0 flex-col gap-4">
        <Section id="campaign-message" title="Message">
          <ChannelFields draft={draft} options={options} channelLocked={saved !== null} onChange={form.change} />
        </Section>
        <Section id="campaign-audience" title="Destinataires">
          <AudienceFields draft={draft} options={options} errors={errors} onChange={form.change} />
        </Section>
        <Section id="campaign-content" title="Contenu">
          {draft.channel === 'email' ? (
            <EmailFields draft={draft} savedImages={saved?.images ?? []} options={options} errors={errors} onChange={form.change} />
          ) : (
            <PushFields draft={draft} options={options} errors={errors} onChange={form.change} />
          )}
        </Section>
      </fieldset>
      {form.unknownRecipients.length > 0 ? (
        <Alert tone="warning" title="Adresses sans compte, non retenues">
          <span className="break-all">{form.unknownRecipients.join(', ')}</span>
        </Alert>
      ) : null}
      {form.invalid ? <Alert tone="danger">Corrigez les champs signalés avant d’enregistrer.</Alert> : null}
      {failure ? (
        <Alert tone="danger" title="L’action a échoué">
          <span className="flex flex-wrap items-center gap-2">
            {failure.message}
            {failure.reloadable ? (
              <Button variant="link" loading={form.reloading} onClick={() => { void form.reload(); }}>
                Recharger la campagne
              </Button>
            ) : null}
          </span>
        </Alert>
      ) : null}
      <CampaignActions
        saved={saved}
        options={options}
        dirty={form.dirty}
        saving={form.saving}
        onSave={() => { void form.save(); }}
        onReload={() => { void form.reload(); }}
        onFailure={form.fail}
      />
    </div>
  );
}
