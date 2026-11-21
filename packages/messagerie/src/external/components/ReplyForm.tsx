'use client';

import { Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Icon, Textarea } from '@eguardimmo/ui';
import { AttachmentList, AttachmentPicker, useAttachments } from '../../components/attachments';
import { FormatToolbar } from '../../components/FormatToolbar';
import { replyInputSchema } from '../../data/inputs';
import { sendFailureMessage } from '../api/errors';
import { fingerprintOf, useSendIntent } from '../clientId';
import { useExternalConfig } from '../context';
import { usePostMessage } from '../queries';
import { NoticeNotAFormalAct } from './parts';

export function ReplyForm({ threadId }: { threadId: string }) {
  const { copy } = useExternalConfig();
  const post = usePostMessage(threadId);
  const attachments = useAttachments();
  const intent = useSendIntent();
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [body, setBody] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [failure, setFailure] = useState<string | null>(null);
  const [focusRequests, setFocusRequests] = useState(0);
  const { isPending } = post;

  useEffect(() => {
    if (focusRequests === 0 || isPending) return;
    bodyRef.current?.focus();
  }, [focusRequests, isPending]);

  const submit = async () => {
    const parsed = replyInputSchema.safeParse({ body });
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
      setFocusRequests((count) => count + 1);
    } catch (error) {
      setFailure(sendFailureMessage(error));
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
        label="Votre réponse"
        hideLabel
        placeholder={copy.thread.replyPlaceholder}
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
      {failure ? <Alert tone="danger" title="Envoi impossible">{failure}</Alert> : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <FormatToolbar fieldRef={bodyRef} value={body} onChange={setBody} disabled={post.isPending} />
          <AttachmentPicker attachments={attachments} variant="icon" disabled={post.isPending} />
        </div>
        <Button type="submit" loading={post.isPending}>
          <Icon icon={Send} />
          Envoyer
        </Button>
      </div>
      <NoticeNotAFormalAct />
    </form>
  );
}
