'use client';

import { Send } from 'lucide-react';
import { useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Alert, Button, Checkbox, Icon, Textarea } from '@eguardimmo/ui';
import { replyInputSchema } from '../data/inputs';
import type { ReplyInput } from '../data/inputs';
import { errorMessage } from '../lib/errors';
import { AttachmentList, AttachmentPicker, useAttachments } from './attachments';
import { FormatToolbar } from './FormatToolbar';

export interface ComposerProps {
  onSend: (input: ReplyInput) => Promise<unknown>;
  placeholder: string;
  label?: string;
  submitLabel?: string;
  allowInternal?: boolean;
  disabled?: boolean;
}

export function Composer({
  onSend,
  placeholder,
  label = 'Votre réponse',
  submitLabel = 'Envoyer',
  allowInternal = false,
  disabled = false,
}: ComposerProps) {
  const attachments = useAttachments();
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [body, setBody] = useState('');
  const [internal, setInternal] = useState(false);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async () => {
    const parsed = replyInputSchema.safeParse({ body });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? 'Saisissez votre message');
      return;
    }
    setFieldError(undefined);
    setFailure(null);
    setPending(true);
    try {
      await onSend({
        body: parsed.data.body,
        attachments: attachments.files,
        ...(allowInternal ? { internal } : {}),
      });
      setBody('');
      setInternal(false);
      attachments.clear();
    } catch (error) {
      setFailure(errorMessage(error));
    } finally {
      setPending(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      if (!pending && !disabled) void submit();
    }
  };

  return (
    <form
      noValidate
      aria-label="Répondre"
      className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-3"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <Textarea
        ref={bodyRef}
        label={label}
        hideLabel
        placeholder={placeholder}
        value={body}
        rows={3}
        disabled={disabled || pending}
        {...(fieldError ? { error: fieldError } : {})}
        onChange={(event) => {
          setBody(event.target.value);
          if (fieldError) setFieldError(undefined);
        }}
        onKeyDown={handleKeyDown}
      />
      <AttachmentList files={attachments.files} onRemove={attachments.remove} />
      {failure ? <Alert tone="danger" title="Envoi impossible">{failure}</Alert> : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <FormatToolbar fieldRef={bodyRef} value={body} onChange={setBody} disabled={disabled || pending} />
          <AttachmentPicker attachments={attachments} variant="icon" disabled={disabled || pending} />
          {allowInternal ? (
            <Checkbox label="Note interne" checked={internal} onChange={(event) => { setInternal(event.target.checked); }} />
          ) : null}
        </div>
        <Button type="submit" loading={pending} disabled={disabled}>
          <Icon icon={Send} />
          {internal ? 'Ajouter la note' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
