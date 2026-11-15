'use client';

import { Send } from 'lucide-react';
import { useState } from 'react';
import { Alert, Button, Icon, Select, TextField, Textarea } from '@eguardimmo/ui';
import { supportTicketInputSchema } from '../data/inputs';
import { useCreateSupportTicket } from '../data/queries';
import { ticketCategorySchema } from '../data/schemas';
import type { TicketCategory } from '../data/schemas';
import { errorMessage } from '../lib/errors';
import { AttachmentList, AttachmentPicker, useAttachments } from './attachments';
import { fieldErrors } from './formErrors';
import type { FieldErrors } from './formErrors';
import { categoryOptions } from './ticketMeta';

export interface ContactSupportFormProps {
  onCreated: (ticketId: string) => void;
  onCancel?: () => void;
}

export function ContactSupportForm({ onCreated, onCancel }: ContactSupportFormProps) {
  const create = useCreateSupportTicket();
  const attachments = useAttachments();
  const [category, setCategory] = useState<TicketCategory>('autre');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const clearError = (key: string) => {
    if (errors[key]) setErrors({ ...errors, [key]: undefined });
  };

  const submit = () => {
    const parsed = supportTicketInputSchema.safeParse({ category, subject, body });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setFailure(null);
    create.mutate(
      { ...parsed.data, attachments: attachments.files },
      {
        onSuccess: (ticket) => { onCreated(ticket.id); },
        onError: (error) => { setFailure(errorMessage(error)); },
      },
    );
  };

  return (
    <form
      noValidate
      aria-label="Contacter le support"
      className="flex min-w-0 flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <Select
        label="Catégorie"
        placeholder="Choisir une catégorie"
        options={categoryOptions}
        value={category}
        onValueChange={(value) => {
          const parsed = ticketCategorySchema.safeParse(value);
          if (parsed.success) setCategory(parsed.data);
        }}
      />
      <TextField
        label="Sujet"
        placeholder="Ex. Je ne retrouve pas ma quittance de novembre"
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
        placeholder="Ex. Bonjour, la quittance de novembre n’apparaît pas dans mes documents."
        rows={5}
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
        {onCancel ? (
          <Button variant="secondary" disabled={create.isPending} onClick={onCancel}>
            Annuler
          </Button>
        ) : null}
        <Button type="submit" loading={create.isPending}>
          <Icon icon={Send} />
          Envoyer au support
        </Button>
      </div>
    </form>
  );
}
