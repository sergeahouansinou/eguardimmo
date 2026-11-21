'use client';

import { Button } from '@eguardimmo/ui';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/parts';
import { campaignErrorMessage } from '../../campaigns/api/errors';
import { AnnouncementRow } from '../components/AnnouncementRow';
import { AnnouncementHeader } from '../components/parts';
import { useAnnouncementsConfig } from '../context';
import { ANNOUNCEMENTS_EMPTY_HINT, ANNOUNCEMENTS_EMPTY_TITLE, ANNOUNCEMENTS_TITLE, announcementsSubtitle } from '../copy';
import { useAnnouncements } from '../queries';

export function AnnouncementsListPage() {
  const { space } = useAnnouncementsConfig();
  const query = useAnnouncements();
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];

  let content;
  if (query.isPending) {
    content = <LoadingBlock label="Chargement des annonces" />;
  } else if (query.isError) {
    content = <ErrorBlock message={campaignErrorMessage(query.error)} onRetry={() => { void query.refetch(); }} />;
  } else if (items.length === 0) {
    content = <EmptyBlock title={ANNOUNCEMENTS_EMPTY_TITLE} hint={ANNOUNCEMENTS_EMPTY_HINT} />;
  } else {
    content = (
      <>
        <ul aria-label="Annonces" className="min-w-0 overflow-hidden rounded-lg border border-line bg-surface">
          {items.map((announcement) => (
            <AnnouncementRow key={announcement.id} announcement={announcement} />
          ))}
        </ul>
        {query.hasNextPage ? (
          <Button variant="secondary" className="self-center" loading={query.isFetchingNextPage} onClick={() => { void query.fetchNextPage(); }}>
            Afficher plus
          </Button>
        ) : null}
      </>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <AnnouncementHeader title={ANNOUNCEMENTS_TITLE} subtitle={announcementsSubtitle[space]} />
      {content}
    </div>
  );
}
