'use client';

import { Send } from 'lucide-react';
import { useState } from 'react';
import { Alert, Button, Icon, Select, TextField, Textarea } from '@eguardimmo/ui';
import { AttachmentList, AttachmentPicker, useAttachments } from '../../components/attachments';
import { fieldErrors } from '../../components/formErrors';
import type { FieldErrors } from '../../components/formErrors';
import { fingerprintOf, useSendIntent } from '../../external/clientId';
import { supportSendFailureMessage } from '../api/errors';
import { categoryLabel } from '../copy';
import { useSupportConfig } from '../context';
import { SUPPORT_CATEGORIES, SUPPORT_SUBJECT_MAX } from '../model';
import type { SupportCategory } from '../model';
import { supportRequestSchema } from '../inputs';
import { useOpenSupportTicket } from '../queries';
import { PrivacyNote } from './parts';

function categoryOf(value: string): SupportCategory | null {
  return SUPPORT_CATEGORIES.find((category) => category === value) ?? null;
}

export function NewRequestForm() {
  const { copy, routes, navigate } = useSupportConfig();
  const open = useOpenSupportTicket();
  const attachments = useAttachments();
  const intent = useSendIntent();
  const [category, setCategory] = useState<SupportCategory>('other');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const clearError = (key: string) => {
    if (errors[key]) setErrors({ ...errors, [key]: undefined });
  };

  const submit = async () => {
    const parsed = supportRequestSchema.safeParse({ subject, body });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setFailure(null);
    const clientId = intent.clientIdFor(fingerprintOf([category, parsed.data.subject, parsed.data.body], attachments.files));
    try {
      const ticket = await open.mutateAsync({ category, subject: parsed.data.subject, body: parsed.data.body, files: attachments.files, clientId });
      intent.settle();
      navigate(routes.ticket(ticket.id));
    } catch (error) {
      setFailure(supportSendFailureMessage(error, 'open'));
    }
  };

  return (
    <form
      noValidate
      aria-label="Nouvelle demande au support"
      className="flex max-w-3xl min-w-0 flex-col gap-4 rounded-lg border border-line bg-surface p-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <Select
        label="Catégorie"
        placeholder="Choisir une catégorie"
        options={SUPPORT_CATEGORIES.map((value) => ({ value, label: categoryLabel[value] }))}
        value={category}
        onValueChange={(value) => {
          const chosen = categoryOf(value);
          if (chosen !== null) setCategory(chosen);
        }}
      />
      <TextField
        label="Sujet"
        placeholder={copy.subjectPlaceholder}
        value={subject}
        maxLength={SUPPORT_SUBJECT_MAX}
        onChange={(event) => {
          setSubject(event.target.value);
          clearError('subject');
        }}
        {...(errors.subject ? { error: errors.subject } : {})}
      />
      <Textarea
        label="Message"
        placeholder={copy.bodyPlaceholder}
        rows={7}
        value={body}
        onChange={(event) => {
          setBody(event.target.value);
          clearError('body');
        }}
        {...(errors.body ? { error: errors.body } : {})}
      />
      <div className="flex flex-col gap-2">
        <AttachmentPicker attachments={attachments} variant="zone" disabled={open.isPending} />
        <AttachmentList files={attachments.files} onRemove={attachments.remove} />
      </div>
      <PrivacyNote />
      {failure ? <Alert tone="danger" title="Envoi impossible">{failure}</Alert> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" disabled={open.isPending} onClick={() => { navigate(routes.board); }}>
          Annuler
        </Button>
        <Button type="submit" loading={open.isPending}>
          <Icon icon={Send} />
          Envoyer au support
        </Button>
      </div>
    </form>
  );
}
