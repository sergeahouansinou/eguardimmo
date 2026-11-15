'use client';

import { Send } from 'lucide-react';
import { useState } from 'react';
import { Alert, Button, Icon, Select, TextField, Textarea } from '@eguardimmo/ui';
import { useMessagerieConfig } from '../config';
import { newMessageInputSchema } from '../data/inputs';
import { useCreateConversation, useRecipients } from '../data/queries';
import { errorMessage } from '../lib/errors';
import { AttachmentList, AttachmentPicker, useAttachments } from './attachments';
import { fieldErrors } from './formErrors';
import type { FieldErrors } from './formErrors';
import { ErrorBlock, LoadingBlock } from './parts';

const NO_LINK = 'none';

export interface NewMessageFormProps {
  initialRecipientId?: string;
}

export function NewMessageForm({ initialRecipientId = '' }: NewMessageFormProps) {
  const { profile, routes, navigate, Link } = useMessagerieConfig();
  const compose = profile.compose;
  const recipients = useRecipients();
  const create = useCreateConversation();
  const attachments = useAttachments();
  const [chosenId, setChosenId] = useState(initialRecipientId);
  const [linkId, setLinkId] = useState(NO_LINK);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<string | null>(null);

  if (recipients.data === undefined) {
    return recipients.isError ? (
      <ErrorBlock message="Impossible de charger les destinataires." onRetry={recipients.refetch} />
    ) : (
      <LoadingBlock label="Chargement du formulaire" />
    );
  }

  const list = recipients.data;
  const single = compose.lockSingleRecipient && list.length === 1 ? list[0] : undefined;
  const recipientId = single?.id ?? chosenId;
  const recipient = list.find((candidate) => candidate.id === recipientId);
  const linkOptions = recipient?.linkOptions ?? [];
  const clearError = (key: string) => {
    if (errors[key]) setErrors({ ...errors, [key]: undefined });
  };

  const submit = () => {
    const parsed = newMessageInputSchema.safeParse({ recipientId, linkId: linkId === NO_LINK ? '' : linkId, subject, body });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setFailure(null);
    create.mutate(
      {
        recipientId: parsed.data.recipientId,
        linkId: parsed.data.linkId === '' ? null : parsed.data.linkId,
        subject: parsed.data.subject,
        body: parsed.data.body,
        attachments: attachments.files,
      },
      {
        onSuccess: (conversation) => { navigate(routes.conversation(conversation.id)); },
        onError: (error) => { setFailure(errorMessage(error)); },
      },
    );
  };

  return (
    <form
      noValidate
      aria-label="Nouveau message"
      className="flex max-w-3xl min-w-0 flex-col gap-4 rounded-lg border border-line bg-surface p-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      {single ? (
        <TextField label={compose.recipientLabel} placeholder={single.name} value={single.name} readOnly />
      ) : (
        <Select
          label={compose.recipientLabel}
          placeholder={compose.recipientPlaceholder}
          searchable
          searchPlaceholder="Rechercher par nom"
          options={list.map((candidate) => ({
            value: candidate.id,
            label: candidate.name,
            ...(candidate.detail ? { description: candidate.detail } : {}),
          }))}
          value={recipientId}
          onValueChange={(value) => {
            setChosenId(value);
            setLinkId(NO_LINK);
            clearError('recipientId');
          }}
          {...(errors.recipientId ? { error: errors.recipientId } : {})}
        />
      )}
      {compose.linkLabel && linkOptions.length > 0 ? (
        <Select
          label={compose.linkLabel}
          placeholder={compose.linkPlaceholder}
          options={[{ value: NO_LINK, label: 'Aucun' }, ...linkOptions.map((option) => ({ value: option.id, label: option.label }))]}
          value={linkId}
          onValueChange={setLinkId}
        />
      ) : null}
      {profile.campaigns ? (
        <p className="text-caption text-fg-muted">
          Plusieurs destinataires ?{' '}
          <Link href={routes.newCampaign} className="text-link underline">
            Créer une campagne
          </Link>
        </p>
      ) : null}
      <TextField
        label="Sujet"
        placeholder={compose.subjectPlaceholder}
        value={subject}
        maxLength={140}
        onChange={(event) => {
          setSubject(event.target.value);
          clearError('subject');
        }}
        {...(errors.subject ? { error: errors.subject } : {})}
      />
      <Textarea
        label="Message"
        placeholder={compose.bodyPlaceholder}
        rows={7}
        value={body}
        onChange={(event) => {
          setBody(event.target.value);
          clearError('body');
        }}
        {...(errors.body ? { error: errors.body } : {})}
      />
      <div className="flex flex-col gap-2">
        <AttachmentPicker attachments={attachments} variant="zone" disabled={create.isPending} />
        <AttachmentList files={attachments.files} onRemove={attachments.remove} />
      </div>
      {failure ? <Alert tone="danger" title="Envoi impossible">{failure}</Alert> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="secondary"
          disabled={create.isPending}
          onClick={() => { navigate(routes.inbox); }}
        >
          Annuler
        </Button>
        <Button type="submit" loading={create.isPending}>
          <Icon icon={Send} />
          Envoyer
        </Button>
      </div>
    </form>
  );
}
