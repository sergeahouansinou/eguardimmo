'use client';

import { Archive, ArchiveRestore } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, CardTitle, Icon } from '@eguardimmo/ui';
import { Composer } from '../components/Composer';
import { ConversationThread } from '../components/ConversationThread';
import { ErrorBlock, LoadingBlock, PageHeader, RoleBadge } from '../components/parts';
import { useMessagerieConfig } from '../config';
import { useMessagerieSource } from '../data/source';
import { useConversation, useReplyToConversation, useSetConversationArchived, useSetConversationRead } from '../data/queries';
import type { Attachment, ConversationDetail } from '../data/schemas';
import { errorMessage } from '../lib/errors';

function ConversationBody({ conversation }: { conversation: ConversationDetail }) {
  const { profile, routes, Link, navigate } = useMessagerieConfig();
  const reply = useReplyToConversation(conversation.id);
  const { mutate: setRead } = useSetConversationRead();
  const archive = useSetConversationArchived();
  const { downloadConversationAttachment } = useMessagerieSource();
  const [failure, setFailure] = useState<string | null>(null);
  const copy = profile.conversation;

  useEffect(() => {
    if (conversation.unread) setRead({ id: conversation.id, read: true });
  }, [conversation.id, conversation.unread, setRead]);

  const openAttachment = downloadConversationAttachment
    ? (attachment: Attachment) => {
        setFailure(null);
        downloadConversationAttachment(attachment).catch((error: unknown) => { setFailure(errorMessage(error)); });
      }
    : undefined;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader
        title={conversation.subject}
        subtitle={copy.subtitle(conversation.counterpart.name, conversation.tag)}
        breadcrumb={[{ label: profile.inbox.title, href: routes.inbox }, { label: conversation.subject }]}
        actions={
          <Button
            variant="secondary"
            loading={archive.isPending}
            onClick={() => {
              setFailure(null);
              archive.mutate(
                { id: conversation.id, archived: !conversation.archived },
                {
                  onSuccess: () => { if (!conversation.archived) navigate(routes.inbox); },
                  onError: (error) => { setFailure(errorMessage(error)); },
                },
              );
            }}
          >
            <Icon icon={conversation.archived ? ArchiveRestore : Archive} />
            {conversation.archived ? 'Désarchiver' : 'Archiver'}
          </Button>
        }
      />
      {failure ? <Alert tone="danger" title="Action impossible">{failure}</Alert> : null}
      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col gap-3">
          <ConversationThread
            messages={conversation.messages}
            participants={conversation.participants}
            viewerId={conversation.viewerId}
            {...(openAttachment ? { onOpenAttachment: openAttachment } : {})}
          />
          <Composer
            label="Votre réponse"
            placeholder={copy.replyPlaceholder}
            submitLabel="Envoyer"
            onSend={reply.mutateAsync}
          />
        </div>
        <aside aria-label={copy.contextTitle} className="flex min-w-0 flex-col gap-3">
          <Card>
            <CardTitle as="h2">{copy.contextTitle}</CardTitle>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-body font-medium text-fg">{conversation.counterpart.name}</span>
              <RoleBadge role={conversation.counterpart.role} />
              {conversation.tag ? <Badge>{conversation.tag}</Badge> : null}
            </div>
            {conversation.counterpart.detail ? <p className="text-caption text-fg-subtle">{conversation.counterpart.detail}</p> : null}
            {conversation.context.length > 0 ? (
              <dl className="flex flex-col gap-1.5">
                {conversation.context.map((row) => (
                  <div key={row.label} className="flex items-start justify-between gap-3 text-body">
                    <dt className="shrink-0 text-fg-subtle">{row.label}</dt>
                    <dd className="min-w-0 text-right text-fg">{row.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {copy.showThreadStats ? (
              <p className="text-caption text-fg-subtle">
                {conversation.messageCount} message{conversation.messageCount > 1 ? 's' : ''} dans cette conversation
              </p>
            ) : null}
          </Card>
          {conversation.links.length > 0 ? (
            <Card>
              <CardTitle as="h2">Éléments liés</CardTitle>
              <ul className="flex flex-col gap-1.5">
                {conversation.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-body font-medium text-action-on-subtle underline underline-offset-3">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

export function ConversationPage({ conversationId }: { conversationId: string }) {
  const conversation = useConversation(conversationId);
  if (conversation.data === undefined) {
    return conversation.isError ? (
      <ErrorBlock message="Conversation introuvable ou inaccessible." onRetry={conversation.refetch} />
    ) : (
      <LoadingBlock label="Chargement de la conversation" />
    );
  }
  return <ConversationBody conversation={conversation.data} />;
}
