import { shellSchema } from '@eguardimmo/shell';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { renderWithConsole } from '../../../test/render';
import { CentreNotifications } from './CentreNotifications';

describe('Centre de notifications de la console', () => {
  it('liste les notifications avec leur lien et renvoie vers les préférences', async () => {
    const { container } = renderWithConsole(<CentreNotifications />);
    const list = await screen.findByRole('list', { name: 'Notifications' });
    expect(within(list).getByRole('link', { name: /Messagerie dégradée/ }).getAttribute('href')).toBe('/sante/incidents/inc-2026-031');
    expect(screen.getByRole('link', { name: 'Préférences' }).getAttribute('href')).toBe('/parametres/notifications');
    await expectNoA11yViolations(container);
  });

  it('marque une notification, puis toutes, comme lues dans la source', async () => {
    const user = userEvent.setup();
    const { source } = renderWithConsole(<CentreNotifications />);
    const unread = async () => shellSchema.parse(await source.shell()).notifications.filter((item) => item.unread).length;
    const before = await unread();
    await user.click(await screen.findByRole('button', { name: 'Marquer comme lue : Messagerie dégradée' }));
    await waitFor(async () => { expect(await unread()).toBe(before - 1); });
    await user.click(screen.getByRole('button', { name: 'Tout marquer comme lu' }));
    await waitFor(async () => { expect(await unread()).toBe(0); });
  });
});
