'use client';

import { Archive, ArchiveRestore } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Alert, Badge, Button, ConfirmDialog, Icon } from '@eguardimmo/ui';
import { ErrorBlock, LoadingBlock } from '../../components/parts';
import { threadErrorMessage } from '../api/errors';
import { ExternalHeader, useNow } from '../components/parts';
import { MessageLog } from '../components/MessageLog';
import { ReplyForm } from '../components/ReplyForm';
import { useExternalConfig } from '../context';
import type { ThreadDetail, ThreadMessage } from '../model';
import { useDownloadAttachment, useEarlierMessages, useMarkThread, useRedactMessage, useThread } from '../queries';

const CLOCK_MS = 30_000;

function ComposerArea({ thread }: { thread: ThreadDetail }) {
  const { copy, routes, Link } = useExternalConfig();
  if (thread.canReply) return <ReplyForm threadId={thread.id} />;
  if (thread.status === 'closed') {
    return (
      <Alert tone="info" title="Conversation fermée">
        <span className="flex flex-wrap items-center gap-2">
          L’agence a fermé cette conversation. Une nouvelle réponse de l’agence la rouvrira.
          <Button asChild variant="link" size="sm">
            <Link href={routes.newThread}>Écrire un nouveau message</Link>
          </Button>
        </span>
      </Alert>
    );
  }
  if (thread.muted) {
    return (
      <Alert tone="warning" title="Envoi restreint">
        L’agence a restreint l’envoi de messages sur cette conversation : vous pouvez encore la lire.
      </Alert>
    );
  }
  return (
    <Alert tone="info" title="Lecture seule">
      {copy.thread.readOnly}
    </Alert>
  );
}

function ThreadBody({ thread }: { thread: ThreadDetail }) {
  const { copy, routes, navigate } = useExternalConfig();
  const mark = useMarkThread();
  const earlier = useEarlierMessages(thread.id);
  const redact = useRedactMessage(thread.id);
  const download = useDownloadAttachment();
  const now = useNow(CLOCK_MS);
  const [failure, setFailure] = useState<string | null>(null);
  const [toRedact, setToRedact] = useState<ThreadMessage | null>(null);
  const markedFor = useRef<string | null>(null);
  const { mutate: markRead } = mark;
  const lastMessage = thread.messages.at(-1);
  const unreadFrom = thread.unread && lastMessage !== undefined && !lastMessage.mine ? lastMessage.id : null;

  useEffect(() => {
    if (unreadFrom === null || markedFor.current === unreadFrom) return;
    if (document.visibilityState === 'hidden') return;
    markedFor.current = unreadFrom;
    markRead({ id: thread.id, read: true }, { onError: () => { markedFor.current = null; } });
  }, [unreadFrom, thread.id, markRead]);

  const fail = (error: unknown) => { setFailure(threadErrorMessage(error)); };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <ExternalHeader
        title={thread.subject}
        subtitle={thread.agencyName === null ? 'Avec votre agence' : `Avec ${thread.agencyName}`}
        breadcrumb={[{ label: copy.inboxTitle, href: routes.inbox }, { label: thread.subject }]}
        actions={
          <Button
            variant="secondary"
            loading={mark.isPending}
            onClick={() => {
              setFailure(null);
              mark.mutate(
                { id: thread.id, archived: !thread.archived },
                { onSuccess: () => { if (!thread.archived) navigate(routes.inbox); }, onError: fail },
              );
            }}
          >
            <Icon icon={thread.archived ? ArchiveRestore : Archive} />
            {thread.archived ? 'Désarchiver' : 'Archiver'}
          </Button>
        }
      />
      <div className="flex flex-wrap items-center gap-1.5">
        {thread.reference ? <Badge wrap>{`${copy.thread.referenceLabel} ${thread.reference.label}`}</Badge> : null}
        {thread.status === 'closed' ? <Badge tone="warning">Fermée</Badge> : null}
        {thread.archived ? <Badge>Archivée</Badge> : null}
      </div>
      {failure ? <Alert tone="danger" title="Action impossible">{failure}</Alert> : null}
      <div className="flex max-w-3xl min-w-0 flex-col gap-3">
        <MessageLog
          thread={thread}
          now={now}
          loadingEarlier={earlier.isPending}
          onLoadEarlier={() => { setFailure(null); earlier.mutate(undefined, { onError: fail }); }}
          onRedact={setToRedact}
          onDownload={(attachment) => { setFailure(null); download.mutate(attachment, { onError: fail }); }}
        />
        <ComposerArea thread={thread} />
      </div>
      <ConfirmDialog
        open={toRedact !== null}
        onOpenChange={(open) => { if (!open) setToRedact(null); }}
        title="Retirer ce message ?"
        description="Le texte sera remplacé par « Message retiré » et les pièces jointes seront supprimées. Cette action est définitive."
        confirmLabel="Retirer le message"
        tone="danger"
        loading={redact.isPending}
        onConfirm={() => {
          if (toRedact === null) return;
          setFailure(null);
          redact.mutate(toRedact, { onError: fail, onSettled: () => { setToRedact(null); } });
        }}
      />
    </div>
  );
}

export function ExternalThreadPage({ threadId }: { threadId: string }) {
  const thread = useThread(threadId);
  if (thread.data === undefined) {
    return thread.isError ? (
      <ErrorBlock message={threadErrorMessage(thread.error)} onRetry={() => { void thread.refetch(); }} />
    ) : (
      <LoadingBlock label="Chargement de la conversation" />
    );
  }
  return <ThreadBody thread={thread.data} />;
}
