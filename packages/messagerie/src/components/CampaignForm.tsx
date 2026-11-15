'use client';

import { FormatToolbar } from './FormatToolbar';
import { CircleCheck, Save, Send } from 'lucide-react';
import { useRef, useState } from 'react';
import { Alert, Button, Checkbox, Icon, RadioGroup, TextField, Textarea } from '@eguardimmo/ui';
import { useMessagerieConfig } from '../config';
import { campaignDraftInputSchema, campaignInputSchema } from '../data/inputs';
import { useCampaign, useCampaignAudiences, useSaveCampaign } from '../data/queries';
import type { Campaign, CampaignAudience } from '../data/schemas';
import { formatDateTime, localValueToIso, toDateTimeLocalValue } from '../lib/dates';
import { errorMessage } from '../lib/errors';
import { AttachmentList, AttachmentPicker, useAttachments } from './attachments';
import { fieldErrors } from './formErrors';
import type { FieldErrors } from './formErrors';
import { ErrorBlock, LoadingBlock } from './parts';

interface Outcome {
  kind: 'sent' | 'scheduled' | 'draft';
  campaign: Campaign;
}

const outcomeTitles: Record<Outcome['kind'], string> = {
  sent: 'Campagne envoyée',
  scheduled: 'Campagne programmée',
  draft: 'Brouillon enregistré',
};

function CampaignFormBody({ audiences, existing }: { audiences: CampaignAudience[]; existing: Campaign | null }) {
  const { profile, routes, Link, navigate } = useMessagerieConfig();
  const config = profile.campaigns;
  const save = useSaveCampaign();
  const attachments = useAttachments();
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [audienceId, setAudienceId] = useState(existing?.audienceId ?? '');
  const [subject, setSubject] = useState(existing?.subject ?? '');
  const [body, setBody] = useState(existing?.body ?? '');
  const [mode, setMode] = useState<'now' | 'scheduled'>(existing?.status === 'programmee' ? 'scheduled' : 'now');
  const [scheduledAt, setScheduledAt] = useState(existing?.scheduledAt ? toDateTimeLocalValue(existing.scheduledAt) : '');
  const [copyToHistory, setCopyToHistory] = useState(true);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const audience = audiences.find((candidate) => candidate.id === audienceId);
  const noEmail = audience?.withoutEmail ?? 0;
  const clearError = (key: string) => {
    if (errors[key]) setErrors({ ...errors, [key]: undefined });
  };

  const insertTag = (tag: string) => {
    const field = bodyRef.current;
    const token = `{{${tag}}}`;
    const start = field?.selectionStart ?? body.length;
    const end = field?.selectionEnd ?? body.length;
    setBody(`${body.slice(0, start)}${token}${body.slice(end)}`);
    clearError('body');
    requestAnimationFrame(() => {
      field?.focus();
      field?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const submit = (target: 'send' | 'draft') => {
    const parsed =
      target === 'draft'
        ? campaignDraftInputSchema.safeParse({ audienceId, subject })
        : campaignInputSchema.safeParse({ audienceId, subject, body, mode, scheduledAt, copyToHistory });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setFailure(null);
    const sendMode = target === 'draft' ? 'draft' : mode;
    save.mutate(
      {
        id: existing?.id ?? null,
        audienceId,
        subject: subject.trim(),
        body: body.trim(),
        mode: sendMode,
        scheduledAt: sendMode === 'scheduled' ? localValueToIso(scheduledAt) : null,
        copyToHistory,
        attachments: attachments.files,
      },
      {
        onSuccess: (campaign) => {
          setOutcome({ kind: sendMode === 'now' ? 'sent' : sendMode === 'scheduled' ? 'scheduled' : 'draft', campaign });
        },
        onError: (error) => { setFailure(errorMessage(error)); },
      },
    );
  };

  if (outcome) {
    const detail =
      outcome.kind === 'scheduled' && outcome.campaign.scheduledAt
        ? `Envoi prévu le ${formatDateTime(outcome.campaign.scheduledAt)} à ${String(outcome.campaign.recipientCount)} destinataires.`
        : outcome.kind === 'sent'
          ? `Envoyée à ${String(outcome.campaign.recipientCount)} destinataires.`
          : 'Vous pourrez la reprendre depuis la liste des campagnes.';
    return (
      <div className="flex max-w-3xl flex-col gap-3 rounded-lg border border-line bg-surface p-4">
        <Alert tone="success" title={outcomeTitles[outcome.kind]}>
          {outcome.campaign.title}. {detail}
        </Alert>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href={routes.campaigns}>Retour aux campagnes</Link>
          </Button>
        </div>
      </div>
    );
  }

  const sendLabel = mode === 'scheduled' ? 'Programmer l’envoi' : 'Envoyer';

  return (
    <form
      noValidate
      aria-label="Nouvelle campagne"
      className="flex max-w-3xl min-w-0 flex-col gap-4 rounded-lg border border-line bg-surface p-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit('send');
      }}
    >
      <fieldset className="flex min-w-0 flex-col gap-2">
        <legend className="mb-1 text-caption text-fg-muted">Destinataires</legend>
        {audiences.map((item) => (
          <label
            key={item.id}
            className="grid cursor-pointer grid-cols-[auto_1fr] gap-x-2 rounded-md border border-line px-3 py-2 text-body has-[:checked]:border-action has-[:checked]:bg-action-subtle"
          >
            <input
              type="radio"
              name="audience"
              value={item.id}
              checked={audienceId === item.id}
              className="row-span-2 mt-1"
              onChange={() => {
                setAudienceId(item.id);
                clearError('audienceId');
              }}
            />
            <span className="font-medium text-fg">{`${item.label} (${String(item.count)})`}</span>
            <span className="text-caption text-fg-muted">{item.detail}</span>
          </label>
        ))}
        {errors.audienceId ? <p className="text-caption text-fg-danger">{errors.audienceId}</p> : null}
        {noEmail > 0 ? (
          <Alert tone="warning" title={`${String(noEmail)} destinataire${noEmail > 1 ? 's' : ''} sans e-mail valide ne recevr${noEmail > 1 ? 'ont' : 'a'} pas ce message.`}>
            {noEmail > 1 ? 'Ils sont exclus' : 'Il est exclu'} de l’envoi. Ajoutez {noEmail > 1 ? 'leur adresse sur leur fiche' : 'son adresse sur sa fiche'} pour {noEmail > 1 ? 'les' : 'l’'}inclure.
          </Alert>
        ) : null}
      </fieldset>

      {config ? (
        <div className="flex min-w-0 flex-col gap-0.5 rounded-md border border-line px-3 py-2">
          <span className="text-caption text-fg-subtle">Expéditeur</span>
          <span className="text-body font-medium text-fg">{config.senderName}</span>
          <span className="text-caption text-fg-muted">{`Réponses reçues dans ${profile.inbox.title}`}</span>
        </div>
      ) : null}

      <TextField
        label="Objet"
        placeholder="Ex. Coupure d’eau lundi 16 novembre"
        value={subject}
        maxLength={140}
        onChange={(event) => {
          setSubject(event.target.value);
          clearError('subject');
        }}
        {...(errors.subject ? { error: errors.subject } : {})}
      />

      <div className="flex flex-col gap-1.5">
        <Textarea
          ref={bodyRef}
          label="Message"
          placeholder="Ex. Bonjour {{Prénom}}, une coupure d’eau est prévue lundi de 9 h à 12 h."
          rows={8}
          value={body}
          onChange={(event) => {
            setBody(event.target.value);
            clearError('body');
          }}
          {...(errors.body ? { error: errors.body } : {})}
        />
        <FormatToolbar fieldRef={bodyRef} value={body} onChange={setBody} />
        {config && config.mergeTags.length > 0 ? (
          <div role="group" aria-label="Variables de personnalisation" className="flex flex-wrap items-center gap-1.5">
            <span className="text-caption text-fg-subtle">Insérer</span>
            {config.mergeTags.map((tag) => (
              <Button key={tag} variant="secondary" size="sm" onClick={() => { insertTag(tag); }}>
                {tag}
              </Button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <AttachmentPicker attachments={attachments} variant="zone" disabled={save.isPending} />
        <AttachmentList files={attachments.files} onRemove={attachments.remove} />
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <RadioGroup
          label="Envoi"
          options={[
            { value: 'now', label: 'Envoyer maintenant' },
            { value: 'scheduled', label: 'Programmer l’envoi' },
          ]}
          value={mode}
          onValueChange={(value) => { setMode(value === 'scheduled' ? 'scheduled' : 'now'); }}
        />
        {mode === 'scheduled' ? (
          <div className="max-w-xs">
            <TextField
              label="Date et heure d’envoi"
              type="datetime-local"
              placeholder="jj/mm/aaaa hh:mm"
              value={scheduledAt}
              onChange={(event) => {
                setScheduledAt(event.target.value);
                clearError('scheduledAt');
              }}
              {...(errors.scheduledAt ? { error: errors.scheduledAt } : {})}
            />
          </div>
        ) : null}
        <Checkbox
          label="Copier le message dans l’historique de chaque destinataire"
          checked={copyToHistory}
          onChange={(event) => { setCopyToHistory(event.target.checked); }}
        />
      </div>

      <section aria-label="Récapitulatif" className="flex flex-col gap-2 rounded-md bg-muted px-3 py-2 text-body text-fg-muted">
        <p>
          {audience
            ? `${String(audience.count)} ${config?.audienceNoun ?? 'destinataires'} · ${audience.label}`
            : 'Aucun destinataire choisi'}
          {config ? ` · Expéditeur : ${config.senderName}` : ''}
        </p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-caption">
          <dt className="text-fg-subtle">Canal</dt>
          <dd className="text-fg">E-mail</dd>
          <dt className="text-fg-subtle">Destinataires</dt>
          <dd className="text-fg">{audience ? `${String(audience.count - noEmail)} sur ${String(audience.count)}` : '—'}</dd>
          <dt className="text-fg-subtle">Envoi</dt>
          <dd className="text-fg">{mode === 'scheduled' ? (scheduledAt ? formatDateTime(localValueToIso(scheduledAt)) : 'À programmer') : 'Tout de suite'}</dd>
        </dl>
      </section>

      {failure ? <Alert tone="danger" title="Enregistrement impossible">{failure}</Alert> : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" disabled={save.isPending} onClick={() => { navigate(routes.campaigns); }}>
          Annuler
        </Button>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" disabled={save.isPending} onClick={() => { submit('draft'); }}>
            <Icon icon={Save} />
            Enregistrer le brouillon
          </Button>
          <Button type="submit" loading={save.isPending}>
            <Icon icon={mode === 'scheduled' ? CircleCheck : Send} />
            {sendLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}

export function CampaignForm({ campaignId = null }: { campaignId?: string | null }) {
  const audiences = useCampaignAudiences();
  const campaign = useCampaign(campaignId);

  if (audiences.data === undefined || campaign.data === undefined) {
    return audiences.isError || campaign.isError ? (
      <ErrorBlock
        message="Impossible de charger la campagne."
        onRetry={() => {
          audiences.refetch();
          campaign.refetch();
        }}
      />
    ) : (
      <LoadingBlock label="Chargement de la campagne" />
    );
  }

  return <CampaignFormBody key={campaign.data?.id ?? 'new'} audiences={audiences.data} existing={campaign.data} />;
}
