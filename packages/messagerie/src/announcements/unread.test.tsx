import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { fakeAnnouncements, pageOf, renderAnnouncements } from '../../test/announcements';
import { SECOND_ANNOUNCEMENT_ID, announcementFixture, readAnnouncementFixture } from './testing';
import { useUnreadAnnouncements } from './queries';

function Badge() {
  const unread = useUnreadAnnouncements();
  return <span>{unread === undefined ? 'inconnu' : `${String(unread.count)}${unread.more ? '+' : ''} non lues`}</span>;
}

describe('compteur d’annonces non lues', () => {
  it('compte les annonces non lues de la première page', async () => {
    const source = fakeAnnouncements({ list: () => Promise.resolve(pageOf([announcementFixture(), readAnnouncementFixture({ id: SECOND_ANNOUNCEMENT_ID })])) });
    renderAnnouncements(<Badge />, { source });

    expect(await screen.findByText('1 non lues')).toBeTruthy();
    expect(source.list).toHaveBeenCalledWith(null, 50);
  });

  it('signale qu’il y en a peut-être davantage quand la page est pleine', async () => {
    const source = fakeAnnouncements({ list: () => Promise.resolve(pageOf([announcementFixture()], 'suite')) });
    renderAnnouncements(<Badge />, { source });
    expect(await screen.findByText('1+ non lues')).toBeTruthy();
  });

  it('n’affiche aucun compteur tant que le serveur n’a pas répondu ou en cas d’échec', async () => {
    const source = fakeAnnouncements({ list: () => Promise.reject(new Error('panne')) });
    renderAnnouncements(<Badge />, { source });
    expect(screen.getByText('inconnu')).toBeTruthy();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.getByText('inconnu')).toBeTruthy();
  });
});
