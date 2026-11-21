'use client';

import { Send } from 'lucide-react';
import { useRef, useState } from 'react';
import { Alert, Button, Icon, Select, TextField, Textarea } from '@eguardimmo/ui';
import { AttachmentList, AttachmentPicker, useAttachments } from '../../components/attachments';
import { FormatToolbar } from '../../components/FormatToolbar';
import { fieldErrors } from '../../components/formErrors';
import type { FieldErrors } from '../../components/formErrors';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/parts';
import { newMessageInputSchema } from '../../data/inputs';
import { sendFailureMessage } from '../api/errors';
import { fingerprintOf, useSendIntent } from '../clientId';
import { useExternalConfig } from '../context';
import { useComposeOptions, useOpenThread } from '../queries';
import { NoticeNotAFormalAct } from './parts';

export function NewThreadForm({ initialOptionId = '' }: { initialOptionId?: string }) {
  const { copy, routes, navigate } = useExternalConfig();
  const options = useComposeOptions();
  const open = useOpenThread();
  const attachments = useAttachments();
  const intent = useSendIntent();
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [chosenId, setChosenId] = useState(initialOptionId);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<string | null>(null);

  if (options.data === undefined) {
    return options.isError ? (
      <ErrorBlock message="Impossible de charger vos destinataires." onRetry={() => { void options.refetch(); }} />
    ) : (
      <LoadingBlock label="Chargement du formulaire" />
    );
  }

  const list = options.data;
  if (list.length === 0) return <EmptyBlock title={copy.newThread.noOptions.title} hint={copy.newThread.noOptions.hint} />;

  const single = list.length === 1 ? list[0] : undefined;
  const optionId = single?.id ?? chosenId;
  const clearError = (key: string) => {
    if (errors[key]) setErrors({ ...errors, [key]: undefined });
  };

  const submit = async () => {
    const parsed = newMessageInputSchema.safeParse({ recipientId: optionId, linkId: '', subject, body });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setFailure(null);
    const clientId = intent.clientIdFor(fingerprintOf([optionId, parsed.data.subject, parsed.data.body], attachments.files));
    try {
      const thread = await open.mutateAsync({ optionId, subject: parsed.data.subject, body: parsed.data.body, files: attachments.files, clientId });
      intent.settle();
      navigate(routes.thread(thread.id));
    } catch (error) {
      setFailure(sendFailureMessage(error));
    }
  };

  return (
    <form
      noValidate
      aria-label="Nouveau message"
      className="flex max-w-3xl min-w-0 flex-col gap-4 rounded-lg border border-line bg-surface p-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      {single ? (
        <TextField label={copy.newThread.optionLabel} placeholder={single.label} value={single.label} readOnly />
      ) : (
        <Select
          label={copy.newThread.optionLabel}
          placeholder={copy.newThread.optionPlaceholder}
          options={list.map((option) => ({ value: option.id, label: option.label }))}
          value={optionId}
          onValueChange={(value) => {
            setChosenId(value);
            clearError('recipientId');
          }}
          {...(errors.recipientId ? { error: errors.recipientId } : {})}
        />
      )}
      <TextField
        label="Objet"
        placeholder={copy.newThread.subjectPlaceholder}
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
          placeholder={copy.newThread.bodyPlaceholder}
          rows={7}
          value={body}
          onChange={(event) => {
            setBody(event.target.value);
            clearError('body');
          }}
          {...(errors.body ? { error: errors.body } : {})}
        />
        <FormatToolbar fieldRef={bodyRef} value={body} onChange={setBody} disabled={open.isPending} />
      </div>
      <div className="flex flex-col gap-2">
        <AttachmentPicker attachments={attachments} variant="zone" disabled={open.isPending} />
        <AttachmentList files={attachments.files} onRemove={attachments.remove} />
      </div>
      <NoticeNotAFormalAct />
      {failure ? <Alert tone="danger" title="Envoi impossible">{failure}</Alert> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" disabled={open.isPending} onClick={() => { navigate(routes.inbox); }}>
          Annuler
        </Button>
        <Button type="submit" loading={open.isPending}>
          <Icon icon={Send} />
          Envoyer
        </Button>
      </div>
    </form>
  );
}
