import { screen, waitFor, within } from '@testing-library/react';
import { shellSchema } from '@eguardimmo/shell';
import { describe, expect, it } from 'vitest';
import { createDemoSource } from '@/data/demoSource';
import { expectNoA11yViolations } from '../../../test/axe';
import { renderScreen } from '../../../test/render';
import { CentreNotifications } from './CentreNotifications';

describe('Centre de notifications du locataire', () => {
  it('liste les notifications, renvoie vers les préférences et marque une notification comme lue dans la source', async () => {
    const source = createDemoSource();
    const unreadBefore = shellSchema.parse(await source.shell()).notifications.filter((item) => item.unread);
    expect(unreadBefore.length).toBeGreaterThan(0);
    const { user, container } = renderScreen(<CentreNotifications />, { source, pathname: '/notifications/toutes' });
    const list = await screen.findByRole('list', { name: 'Notifications' });
    expect(within(list).getAllByRole('listitem').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Préférences' }).getAttribute('href')).toBe('/notifications');
    await expectNoA11yViolations(container);

    const first = unreadBefore[0];
    if (!first) throw new Error('aucune notification non lue');
    await user.click(screen.getByRole('button', { name: `Marquer comme lue : ${first.title}` }));
    await screen.findByRole('list', { name: 'Notifications' });
    const unreadAfter = shellSchema.parse(await source.shell()).notifications.filter((item) => item.unread);
    expect(unreadAfter).toHaveLength(unreadBefore.length - 1);
  });

  it('marque tout comme lu dans la source', async () => {
    const source = createDemoSource();
    const { user } = renderScreen(<CentreNotifications />, { source, pathname: '/notifications/toutes' });
    await user.click(await screen.findByRole('button', { name: 'Tout marquer comme lu' }));
    await waitFor(async () => {
      const after = shellSchema.parse(await source.shell()).notifications;
      expect(after.every((item) => !item.unread)).toBe(true);
    });
  });
});
