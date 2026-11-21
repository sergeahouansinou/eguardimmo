'use client';

import { useEffect, useRef, useState } from 'react';
import { Alert, Badge, ConfirmDialog } from '@eguardimmo/ui';
import { ErrorBlock, LoadingBlock } from '../../../components/parts';
import { formatDateTime } from '../../../lib/dates';
import { staffErrorMessage } from '../api/errors';
import { StaffMessageLog } from '../components/MessageLog';
import { MuteDialog } from '../components/MuteDialog';
import { StaffHeader } from '../components/parts';
import { RedactDialog } from '../components/RedactDialog';
import { StaffReplyForm } from '../components/ReplyForm';
import { ThreadToolbar } from '../components/ThreadToolbar';
import { useStaffConfig } from '../context';
import { staffKindCopy } from '../copy';
import type { StaffMessage, StaffThreadDetail } from '../model';
import { useStaffDownload, useStaffEarlier, useStaffMarkThread, useStaffRestrict, useStaffThread, useStaffUpdateThread } from '../queries';
import { useNow } from '../../components/parts';

const CLOCK_MS = 30_000;

function ThreadBody({ thread }: { thread: StaffThreadDetail }) {
  const { routes, navigate, capabilities, useProof } = useStaffConfig();
  const copy = staffKindCopy[thread.kind];
  const proof = useProof();
  const mark = useStaffMarkThread();
  const update = useStaffUpdateThread(thread.id);
  const lift = useStaffRestrict(thread.id);
  const earlier = useStaffEarlier(thread.id);
  const download = useStaffDownload();
  const now = useNow(CLOCK_MS);
  const [failure, setFailure] = useState<string | null>(null);
  const [toRedact, setToRedact] = useState<StaffMessage | null>(null);
  const [muting, setMuting] = useState(false);
  const [lifting, setLifting] = useState(false);
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

  const fail = (error: unknown) => { setFailure(staffErrorMessage(error)); };
  const busy = mark.isPending || update.isPending || lift.isPending;
  const partyName = thread.party.name ?? 'La personne';
  const reference = thread.lease ?? thread.mandate;
  const referenceLabel = `${thread.lease ? staffKindCopy.tenant.referenceLabel : staffKindCopy.owner.referenceLabel} ${reference?.reference ?? ''}`.trim();

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <StaffHeader
        title={thread.subject}
        subtitle={`Avec ${partyName} · ${copy.counterpartBadge}`}
        breadcrumb={[{ label: 'Messages', href: routes.section(thread.kind) }, { label: thread.subject }]}
      />
      <div className="flex flex-wrap items-center gap-1.5">
        {reference ? <Badge wrap>{referenceLabel}</Badge> : null}
        {thread.status === 'closed' ? <Badge tone="warning">Fermée</Badge> : <Badge tone="success">Ouverte</Badge>}
        {thread.archived ? <Badge>Archivée</Badge> : null}
        {thread.mutedUntil !== null ? <Badge tone="warning">Restreinte</Badge> : null}
      </div>
      <ThreadToolbar
        thread={thread}
        busy={busy}
        onRead={() => { setFailure(null); mark.mutate({ id: thread.id, read: true }, { onError: fail }); }}
        onArchive={() => {
          setFailure(null);
          mark.mutate(
            { id: thread.id, archived: !thread.archived },
            { onSuccess: () => { if (!thread.archived) navigate(routes.section(thread.kind)); }, onError: fail },
          );
        }}
        onStatus={() => { setFailure(null); update.mutate({ status: thread.status === 'open' ? 'closed' : 'open' }, { onError: fail }); }}
        onAssign={(assigneeId) => { setFailure(null); update.mutate({ assigneeId }, { onError: fail }); }}
        onRestrict={() => { setFailure(null); setMuting(true); }}
        onLift={() => { setFailure(null); setLifting(true); }}
      />
      {thread.mutedUntil !== null ? (
        <Alert tone="warning" title="Envoi restreint">
          {`${partyName} peut relire cette conversation sans y répondre, jusqu’au ${formatDateTime(thread.mutedUntil)}.`}
          {thread.mutedReason ? ` Motif : ${thread.mutedReason}` : ''}
        </Alert>
      ) : null}
      {failure ? <Alert tone="danger" title="Action impossible">{failure}</Alert> : null}
      <div className="flex max-w-3xl min-w-0 flex-col gap-3">
        <StaffMessageLog
          thread={thread}
          now={now}
          administer={capabilities.administer}
          loadingEarlier={earlier.isPending}
          onLoadEarlier={() => { setFailure(null); earlier.mutate(undefined, { onError: fail }); }}
          onRedact={setToRedact}
          onDownload={(attachment) => { setFailure(null); download.mutate(attachment, { onError: fail }); }}
        />
        <StaffReplyForm threadId={thread.id} closed={thread.status === 'closed'} />
      </div>
      <RedactDialog threadId={thread.id} message={toRedact} proof={proof} now={now} onClose={() => { setToRedact(null); }} />
      <MuteDialog threadId={thread.id} partyLabel={partyName} open={muting} proof={proof} onClose={() => { setMuting(false); }} />
      <ConfirmDialog
        open={lifting}
        onOpenChange={setLifting}
        title="Lever la restriction ?"
        description={`${partyName} pourra de nouveau répondre dans cette conversation.`}
        confirmLabel="Lever la restriction"
        loading={lift.isPending}
        onConfirm={() => {
          setFailure(null);
          lift.mutate(null, { onError: fail, onSettled: () => { setLifting(false); } });
        }}
      />
      {proof.dialog}
    </div>
  );
}

export function StaffThreadPage({ threadId }: { threadId: string }) {
  const thread = useStaffThread(threadId);
  if (thread.data === undefined) {
    return thread.isError ? (
      <ErrorBlock message={staffErrorMessage(thread.error)} onRetry={() => { void thread.refetch(); }} />
    ) : (
      <LoadingBlock label="Chargement de la conversation" />
    );
  }
  return <ThreadBody thread={thread.data} />;
}
