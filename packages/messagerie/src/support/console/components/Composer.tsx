'use client';

import { Lock, Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Icon, RadioGroup, Textarea, cx } from '@eguardimmo/ui';
import { AttachmentList, AttachmentPicker, useAttachments } from '../../../components/attachments';
import { fingerprintOf, useSendIntent } from '../../../external/clientId';
import { BODY_MAX } from '../model';
import type { ConsoleTicketDetail } from '../model';
import { consoleSendFailureMessage } from '../api/errors';
import { usePostConsoleMessage } from '../queries';

type Mode = 'reply' | 'note';

const MODES = [
  { value: 'reply', label: 'Réponse au demandeur' },
  { value: 'note', label: 'Note interne' },
] as const;

function isMode(value: string): value is Mode {
  return value === 'reply' || value === 'note';
}

export function Composer({ ticket }: { ticket: ConsoleTicketDetail }) {
  const post = usePostConsoleMessage(ticket.id);
  const attachments = useAttachments();
  const intent = useSendIntent();
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [mode, setMode] = useState<Mode>('reply');
  const [body, setBody] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [failure, setFailure] = useState<string | null>(null);
  const [focusRequests, setFocusRequests] = useState(0);
  const { isPending } = post;
  const internal = mode === 'note';
  useEffect(() => {
    if (focusRequests === 0 || isPending) return;
    bodyRef.current?.focus();
  }, [focusRequests, isPending]);
  const submit = async () => {
    const text = body.trim();
    if (text === '' || text.length > BODY_MAX) {
      setFieldError(text === '' ? 'Saisissez votre message' : '5 000 caractères au maximum');
      return;
    }
    setFieldError(undefined);
    setFailure(null);
    const clientId = intent.clientIdFor(fingerprintOf([text, internal ? 'note' : 'reply'], attachments.files));
    try {
      await post.mutateAsync({ body: text, files: attachments.files, clientId, internal });
      intent.settle();
      setBody('');
      attachments.clear();
      setFocusRequests((count) => count + 1);
    } catch (error) {
      setFailure(consoleSendFailureMessage(error));
    }
  };
  return (
    <form
      noValidate
      aria-label={internal ? 'Ajouter une note interne' : 'Répondre au demandeur'}
      className={cx(
        'flex flex-col gap-2 rounded-lg p-3',
        internal ? 'border-2 border-dashed border-warning-line bg-warning text-warning-fg' : 'border border-line bg-surface',
      )}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <RadioGroup label="Type de message" options={MODES} value={mode} onValueChange={(value) => { if (isMode(value)) setMode(value); }} />
      <p aria-live="polite" className={cx('flex items-start gap-1.5 text-body font-semibold', internal ? 'text-warning-fg' : 'text-fg')}>
        <Icon icon={internal ? Lock : Send} size={16} className="mt-0.5 shrink-0" />
        <span>
          {internal
            ? 'Cette note n’est visible que par l’équipe : le demandeur ne la verra jamais.'
            : `Ce message sera envoyé à ${ticket.requester.name} et visible par lui.`}
        </span>
      </p>
      {ticket.status === 'resolved' && !internal ? (
        <p className="text-caption text-fg-muted">Cette demande est résolue : une réponse la rouvre et la met en attente du demandeur.</p>
      ) : null}
      <Textarea
        ref={bodyRef}
        label={internal ? 'Votre note interne' : 'Votre réponse au demandeur'}
        hideLabel
        placeholder={internal ? 'Écrivez une note pour l’équipe' : 'Écrivez votre réponse au demandeur'}
        value={body}
        rows={4}
        disabled={post.isPending}
        {...(fieldError ? { error: fieldError } : {})}
        onChange={(event) => {
          setBody(event.target.value);
          if (fieldError) setFieldError(undefined);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            if (!post.isPending) void submit();
          }
        }}
      />
      <AttachmentList files={attachments.files} onRemove={attachments.remove} />
      {failure ? <Alert tone="danger" title="Envoi impossible">{failure}</Alert> : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <AttachmentPicker attachments={attachments} variant="icon" disabled={post.isPending} />
        <Button type="submit" loading={post.isPending} variant={internal ? 'secondary' : 'primary'}>
          <Icon icon={internal ? Lock : Send} />
          {internal ? 'Ajouter la note interne' : 'Envoyer au demandeur'}
        </Button>
      </div>
    </form>
  );
}
