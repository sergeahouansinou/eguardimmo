'use client';

import { useEffect, useRef, useState } from 'react';
import { Alert, Badge, Button } from '@eguardimmo/ui';
import { campaignErrorMessage } from '../../campaigns/api/errors';
import { AttachmentChip } from '../../components/attachments';
import { ErrorBlock, LoadingBlock } from '../../components/parts';
import { formatDateTime } from '../../lib/dates';
import { AnnouncementHeader } from '../components/parts';
import { useAnnouncementsConfig } from '../context';
import { ANNOUNCEMENTS_TITLE, PURGED_TEXT } from '../copy';
import type { Announcement } from '../model';
import { useAnnouncement, useDownloadAnnouncementAttachment, useMarkAnnouncementRead } from '../queries';

function useMarkOnOpen(announcement: Announcement) {
  const mark = useMarkAnnouncementRead();
  const attempted = useRef(false);
  const { mutate } = mark;
  useEffect(() => {
    if (!announcement.unread || attempted.current) return;
    attempted.current = true;
    mutate(announcement.id);
  }, [announcement.id, announcement.unread, mutate]);
  return mark;
}

function DetailBody({ announcement }: { announcement: Announcement }) {
  const { routes } = useAnnouncementsConfig();
  const mark = useMarkOnOpen(announcement);
  const download = useDownloadAnnouncementAttachment(announcement.id);
  const [problem, setProblem] = useState<string | null>(null);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <AnnouncementHeader
        title={announcement.subject}
        breadcrumb={[{ label: 'Messages', href: routes.messages }, { label: ANNOUNCEMENTS_TITLE, href: routes.list }, { label: announcement.subject }]}
        actions={announcement.unread ? <Badge tone="info">Non lue</Badge> : <Badge tone="neutral">Lue</Badge>}
      />
      {mark.isError ? (
        <Alert tone="warning" title="Lecture non enregistrée">
          {campaignErrorMessage(mark.error)}
          <Button variant="secondary" size="sm" className="mt-2" loading={mark.isPending} onClick={() => { mark.mutate(announcement.id); }}>
            Marquer comme lue
          </Button>
        </Alert>
      ) : null}
      <article aria-label="Annonce" className="flex max-w-3xl min-w-0 flex-col gap-3 rounded-lg border border-line bg-surface p-4">
        <p className="text-caption text-fg-muted">
          {announcement.organizationName}
          {announcement.sentAt ? ` · ${formatDateTime(announcement.sentAt)}` : ''}
        </p>
        {announcement.contentPurged ? (
          <Alert tone="info" title="Contenu effacé">{PURGED_TEXT}</Alert>
        ) : (
          <p className="text-body break-words whitespace-pre-wrap text-fg">{announcement.body}</p>
        )}
        {announcement.attachments.length > 0 ? (
          <section aria-label="Pièces jointes" className="flex min-w-0 flex-col gap-2">
            <h2 className="text-body font-semibold text-fg">{`Pièces jointes (${String(announcement.attachments.length)})`}</h2>
            <ul aria-label="Pièces de l’annonce" className="flex flex-wrap gap-1.5">
              {announcement.attachments.map((attachment) => (
                <li key={attachment.id} className="flex max-w-full min-w-0">
                  <AttachmentChip
                    name={attachment.name}
                    sizeBytes={attachment.sizeBytes}
                    mimeType="application/pdf"
                    onOpen={() => {
                      setProblem(null);
                      download.mutate(attachment, { onError: (error) => { setProblem(campaignErrorMessage(error)); } });
                    }}
                  />
                </li>
              ))}
            </ul>
            {problem ? <Alert tone="danger" title="Téléchargement impossible">{problem}</Alert> : null}
          </section>
        ) : null}
      </article>
    </div>
  );
}

export function AnnouncementDetailPage({ announcementId }: { announcementId: string }) {
  const query = useAnnouncement(announcementId);
  if (query.data === undefined) {
    return query.isError ? (
      <ErrorBlock message={campaignErrorMessage(query.error)} onRetry={() => { void query.refetch(); }} />
    ) : (
      <LoadingBlock label="Chargement de l’annonce" />
    );
  }
  return <DetailBody announcement={query.data} />;
}
