'use client';

import { Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Icon, Textarea } from '@eguardimmo/ui';
import { AttachmentList, AttachmentPicker, useAttachments } from '../../components/attachments';
import { ApiError } from '@eguardimmo/api';
import { fingerprintOf, useSendIntent } from '../../external/clientId';
import { supportSendFailureMessage } from '../api/errors';
import { useSupportConfig } from '../context';
import { SUPPORT_REOPEN_DAYS } from '../model';
import type { SupportTicketStatus } from '../model';
import { supportReplySchema } from '../inputs';
import { usePostSupportMessage } from '../queries';
import { PrivacyNote } from './parts';

export function ReplyForm({ ticketId, status }: { ticketId: string; status: SupportTicketStatus }) {
  const { Link, routes } = useSupportConfig();
  const post = usePostSupportMessage(ticketId);
  const attachments = useAttachments();
  const intent = useSendIntent();
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [body, setBody] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [failure, setFailure] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [focusRequests, setFocusRequests] = useState(0);
  const { isPending } = post;

  useEffect(() => {
    if (focusRequests === 0 || isPending) return;
    bodyRef.current?.focus();
  }, [focusRequests, isPending]);

  const submit = async () => {
    const parsed = supportReplySchema.safeParse({ body });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? 'Saisissez votre message');
      return;
    }
    setFieldError(undefined);
    setFailure(null);
    const clientId = intent.clientIdFor(fingerprintOf([parsed.data.body], attachments.files));
    try {
      await post.mutateAsync({ body: parsed.data.body, files: attachments.files, clientId });
      intent.settle();
      setBody('');
      attachments.clear();
      setExpired(false);
      setFocusRequests((count) => count + 1);
    } catch (error) {
      setExpired(error instanceof ApiError && error.code === 'ticket_resolved');
      setFailure(supportSendFailureMessage(error));
    }
  };

  return (
    <form
      noValidate
      aria-label="Répondre au support"
      className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-3"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      {status === 'resolved' ? (
        <Alert tone="info" title="Demande résolue">
          Votre message rouvre la demande, jusqu’à {String(SUPPORT_REOPEN_DAYS)} jours après sa résolution. Au-delà, ouvrez une nouvelle demande.
        </Alert>
      ) : null}
      <Textarea
        ref={bodyRef}
        label="Votre message"
        hideLabel
        placeholder="Écrivez votre message au support"
        value={body}
        rows={3}
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
      {failure ? (
        <Alert tone="danger" title="Envoi impossible">
          <span className="flex flex-wrap items-center gap-2">
            {failure}
            {expired ? (
              <Button asChild variant="link" size="sm">
                <Link href={routes.newRequest}>Ouvrir une nouvelle demande</Link>
              </Button>
            ) : null}
          </span>
        </Alert>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <AttachmentPicker attachments={attachments} variant="icon" disabled={post.isPending} />
        <Button type="submit" loading={post.isPending}>
          <Icon icon={Send} />
          Envoyer
        </Button>
      </div>
      <PrivacyNote />
    </form>
  );
}
