import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ShellData, ShellNotification } from '../data/schemas';
import type { ShellSource } from '../data/source';
import { expectNoA11yViolations } from '../../test/axe';
import { testShell } from '../../test/fixtures';
import { TestLink, renderWithSource } from '../../test/render';
import { NotificationsPage } from './NotificationsPage';

interface DemoSource extends ShellSource {
  markNotificationRead: (id: string) => Promise<void>;
}

function createSource(notifications: ShellNotification[] = testShell.notifications, overrides: Partial<ShellSource> = {}): DemoSource {
  let shell: ShellData = { ...structuredClone(testShell), notifications: structuredClone(notifications) };
  return {
    shell: () => Promise.resolve(structuredClone(shell)),
    markAllNotificationsRead: () => {
      shell = { ...shell, notifications: shell.notifications.map((item) => ({ ...item, unread: false })) };
      return Promise.resolve();
    },
    markNotificationRead: (id) => {
      shell = { ...shell, notifications: shell.notifications.map((item) => (item.id === id ? { ...item, unread: false } : item)) };
      return Promise.resolve();
    },
    ...overrides,
  };
}

function manyNotifications(count: number): ShellNotification[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `n${String(index + 1)}`,
    tone: 'info' as const,
    title: `Notification ${String(index + 1)}`,
    detail: 'Aujourd’hui',
    unread: index % 2 === 0,
    href: `/objets/${String(index + 1)}`,
  }));
}

describe('NotificationsPage', () => {
  it('liste toutes les notifications avec le lien vers l’objet et les préférences', async () => {
    const { container } = renderWithSource(<NotificationsPage Link={TestLink} settingsHref="/notifications" />, createSource());
    const list = await screen.findByRole('list', { name: 'Notifications' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(within(list).getByRole('link', { name: /Loyer impayé/ }).getAttribute('href')).toBe('/impayes');
    expect(within(list).getByRole('link', { name: /Bail renouvelé/ }).getAttribute('href')).toBe('/baux');
    expect(screen.getByRole('link', { name: 'Préférences' }).getAttribute('href')).toBe('/notifications');
    await expectNoA11yViolations(container);
  });

  it('n’affiche pas le lien vers les préférences sans settingsHref', async () => {
    renderWithSource(<NotificationsPage Link={TestLink} />, createSource());
    await screen.findByRole('list', { name: 'Notifications' });
    expect(screen.queryByRole('link', { name: 'Préférences' })).toBeNull();
  });

  it('filtre les non lues puis revient à toutes', async () => {
    const user = userEvent.setup();
    renderWithSource(<NotificationsPage Link={TestLink} />, createSource());
    await screen.findByRole('list', { name: 'Notifications' });
    await user.click(screen.getByRole('tab', { name: /Non lues/ }));
    const list = screen.getByRole('list', { name: 'Notifications' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    expect(within(list).queryByText('Bail renouvelé')).toBeNull();
    await user.click(screen.getByRole('tab', { name: /Toutes/ }));
    expect(within(screen.getByRole('list', { name: 'Notifications' })).getAllByRole('listitem')).toHaveLength(2);
  });

  it('marque une notification comme lue, elle quitte l’onglet des non lues', async () => {
    const user = userEvent.setup();
    renderWithSource(<NotificationsPage Link={TestLink} />, createSource());
    await user.click(await screen.findByRole('tab', { name: /Non lues/ }));
    await user.click(await screen.findByRole('button', { name: 'Marquer comme lue : Loyer impayé' }));
    expect(await screen.findByText('Aucune notification non lue')).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Non lues/ }).textContent).toContain('0');
  });

  it('marque tout comme lu puis désactive l’action', async () => {
    const user = userEvent.setup();
    const source = createSource();
    const markAll = vi.spyOn(source, 'markAllNotificationsRead');
    renderWithSource(<NotificationsPage Link={TestLink} />, source);
    await screen.findByRole('list', { name: 'Notifications' });
    const button = screen.getByRole('button', { name: 'Tout marquer comme lu' });
    await user.click(button);
    await waitFor(() => { expect(markAll).toHaveBeenCalledTimes(1); });
    await waitFor(() => { expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Tout marquer comme lu' }).disabled).toBe(true); });
    expect(screen.queryByRole('button', { name: /Marquer comme lue :/ })).toBeNull();
    expect(screen.queryByText('Non lue')).toBeNull();
  });

  it('masque le marquage individuel quand la source ne le propose pas', async () => {
    const { shell, markAllNotificationsRead } = createSource();
    renderWithSource(<NotificationsPage Link={TestLink} />, { shell, markAllNotificationsRead });
    await screen.findByRole('list', { name: 'Notifications' });
    expect(screen.queryByRole('button', { name: /Marquer comme lue :/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Tout marquer comme lu' })).toBeTruthy();
  });

  it('signale l’échec du marquage sans changer l’état', async () => {
    const user = userEvent.setup();
    const source = createSource(testShell.notifications, { markAllNotificationsRead: () => Promise.reject(new Error('panne')) });
    renderWithSource(<NotificationsPage Link={TestLink} />, source);
    await screen.findByRole('list', { name: 'Notifications' });
    await user.click(screen.getByRole('button', { name: 'Tout marquer comme lu' }));
    expect((await screen.findByRole('alert')).textContent).toContain('n’ont pas pu être marquées comme lues');
    expect(screen.getByText('Non lue')).toBeTruthy();
  });

  it('affiche l’état vide quand il n’y a aucune notification', async () => {
    const { container } = renderWithSource(<NotificationsPage Link={TestLink} />, createSource([]));
    expect(await screen.findByText('Aucune notification')).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Tout marquer comme lu' }).disabled).toBe(true);
    await expectNoA11yViolations(container);
  });

  it('affiche l’erreur de chargement et recharge au clic sur Réessayer', async () => {
    const user = userEvent.setup();
    let fail = true;
    const base = createSource();
    const source = createSource(testShell.notifications, {
      shell: () => (fail ? Promise.reject(new Error('panne')) : base.shell()),
    });
    const { container } = renderWithSource(<NotificationsPage Link={TestLink} />, source);
    expect((await screen.findByRole('alert')).textContent).toContain('n’ont pas pu être chargées');
    await expectNoA11yViolations(container);
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByRole('list', { name: 'Notifications' })).toBeTruthy();
  });

  it('pagine au-delà de 20 notifications et revient à la première page au changement de filtre', async () => {
    const user = userEvent.setup();
    const { container } = renderWithSource(<NotificationsPage Link={TestLink} />, createSource(manyNotifications(45)));
    await screen.findByRole('list', { name: 'Notifications' });
    expect(screen.getAllByRole('listitem')).toHaveLength(20);
    expect(screen.getByText('1 à 20 sur 45')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /Suivant/ }));
    expect(screen.getByText('21 à 40 sur 45')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /Suivant/ }));
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    await expectNoA11yViolations(container);
    await user.click(screen.getByRole('tab', { name: /Non lues/ }));
    expect(screen.getByText('1 à 20 sur 23')).toBeTruthy();
  });

  it('n’affiche pas de pagination jusqu’à 20 notifications', async () => {
    renderWithSource(<NotificationsPage Link={TestLink} />, createSource(manyNotifications(20)));
    await screen.findByRole('list', { name: 'Notifications' });
    expect(screen.queryByRole('navigation', { name: 'Pagination des notifications' })).toBeNull();
  });
});
