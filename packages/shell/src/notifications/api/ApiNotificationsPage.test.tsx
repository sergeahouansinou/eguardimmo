import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { ApiNotificationsPage } from './ApiNotificationsPage';
import {
  ORGANIZATION_ID,
  listPage1,
  listPage2,
  listTenant,
  listUnread,
  readAll,
  readOne,
  unauthenticatedProblem,
  unreadCount,
} from './responses.fixtures';
import { TestLink, renderWithApi, stubApi } from './testing';
import type { Reply } from './testing';

afterEach(() => {
  vi.unstubAllGlobals();
});

const COUNT = 'GET /api/v1/notifications/unread-count';
const LIST = 'GET /api/v1/notifications';
const OVERDUE_ID = listPage2.data[0]?.id ?? '';
const empty = { data: [], meta: { next_cursor: null } };
const problem = (status: number, code: string) => ({ ...unauthenticatedProblem, status, code });

function renderPage(organizationId: string | null = ORGANIZATION_ID) {
  return renderWithApi(<ApiNotificationsPage Link={TestLink} settingsHref="/compte/notifications" />, organizationId);
}

function paged(call: { search: URLSearchParams }) {
  return { body: call.search.get('cursor') === null ? listPage1 : listPage2 };
}

describe('page « Toutes les notifications » en mode API', () => {
  it('liste les notifications du serveur, puis charge la suite par curseur', async () => {
    const api = stubApi({ [COUNT]: { body: unreadCount }, [LIST]: paged });

    const { user } = renderPage();

    const list = await screen.findByRole('list', { name: 'Notifications' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'Préférences' }).getAttribute('href')).toBe('/compte/notifications');

    await user.click(screen.getByRole('button', { name: 'Charger plus' }));

    await waitFor(() => { expect(within(screen.getByRole('list', { name: 'Notifications' })).getAllByRole('listitem')).toHaveLength(3); });
    expect(screen.queryByRole('button', { name: 'Charger plus' })).toBeNull();
    const second = api.callsTo('GET', '/api/v1/notifications')[1];
    expect(second?.search.get('cursor')).toBe(listPage1.meta.next_cursor);
    expect(second?.search.get('organization')).toBe(ORGANIZATION_ID);
  });

  it('filtre les non lues auprès du serveur', async () => {
    const api = stubApi({ [COUNT]: { body: unreadCount }, [LIST]: (call) => ({ body: call.search.get('unread') === '1' ? listUnread : listPage1 }) });

    const { user } = renderPage();

    await screen.findByRole('list', { name: 'Notifications' });
    await user.click(screen.getByRole('tab', { name: /Non lues/ }));

    await waitFor(() => { expect(api.callsTo('GET', '/api/v1/notifications').some((call) => call.search.get('unread') === '1')).toBe(true); });
    await waitFor(() => { expect(screen.queryByRole('link', { name: /Pièce expirée/ })).toBeNull(); });
    expect(screen.getByRole('link', { name: /Loyer en retard/ })).toBeTruthy();
  });

  it('marque une notification lue, le compteur suit', async () => {
    let unread = 2;
    const api = stubApi({
      [COUNT]: () => ({ body: { data: { unread } } }),
      [LIST]: { body: listUnread },
      [`POST /api/v1/notifications/${OVERDUE_ID}/read`]: () => {
        unread = 1;
        return { body: readOne };
      },
    });

    const { user } = renderPage();

    await user.click(await screen.findByRole('button', { name: 'Marquer comme lue : Loyer en retard' }));

    await waitFor(() => { expect(screen.getByRole('tab', { name: /Non lues/ }).textContent).toContain('1'); });
    expect(api.callsTo('POST', `/api/v1/notifications/${OVERDUE_ID}/read`)).toHaveLength(1);
  });

  it('marque tout comme lu pour l’organisation courante', async () => {
    let unread = 2;
    const api = stubApi({
      [COUNT]: () => ({ body: { data: { unread } } }),
      [LIST]: { body: listUnread },
      'POST /api/v1/notifications/read-all': () => {
        unread = 0;
        return { body: readAll };
      },
    });

    const { user } = renderPage();

    const button = await screen.findByRole('button', { name: 'Tout marquer comme lu' });
    await waitFor(() => { expect(button.hasAttribute('disabled')).toBe(false); });
    await user.click(button);

    await waitFor(() => { expect(button.hasAttribute('disabled')).toBe(true); });
    expect(api.callsTo('POST', '/api/v1/notifications/read-all')[0]?.body).toEqual({ organization: ORGANIZATION_ID });
  });

  it('affiche l’état vide sans donnée de démonstration', async () => {
    stubApi({ [COUNT]: { body: { data: { unread: 0 } } }, [LIST]: { body: empty } });

    renderPage();

    expect(await screen.findByText('Aucune notification')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tout marquer comme lu' }).hasAttribute('disabled')).toBe(true);
    expect(screen.queryByRole('list', { name: 'Notifications' })).toBeNull();
  });

  it('côté locataire, n’envoie aucune organisation et suit le lien relatif', async () => {
    const api = stubApi({ [COUNT]: { body: unreadCount }, [LIST]: { body: listTenant } });

    renderPage(null);

    const link = await screen.findByRole('link', { name: /Quittance émise/ });
    expect(link.getAttribute('href')).toBe('/loyers');
    expect(api.callsTo('GET', '/api/v1/notifications')[0]?.search.has('organization')).toBe(false);
  });

  it('n’affiche jamais un lien externe : le titre reste lisible mais n’est pas un lien', async () => {
    const hostile = { ...listPage2.data[0], href: 'javascript:alert(1)' };
    stubApi({ [COUNT]: { body: unreadCount }, [LIST]: { body: { data: [hostile], meta: { next_cursor: null } } } });

    renderPage();

    expect(await screen.findByRole('button', { name: /^Loyer en retard/ })).toBeTruthy();
    expect(document.querySelector('a[href^="javascript"]')).toBeNull();
  });

  it.each([
    ['401', { status: 401, body: problem(401, 'unauthenticated') }, 'Votre session a expiré. Reconnectez-vous pour continuer.'],
    ['403', { status: 403, body: problem(403, 'forbidden') }, 'Vous n’avez pas le droit d’effectuer cette action.'],
    ['429', { status: 429, body: problem(429, 'too_many_requests') }, /Trop de demandes en peu de temps/],
    ['réseau', { network: true }, 'Le serveur est injoignable. Vérifiez votre connexion et réessayez.'],
  ] as [string, Reply, string | RegExp][])('traduit l’erreur %s en français, sans donnée de démonstration', async (_name, reply, message) => {
    stubApi({ [COUNT]: { body: unreadCount }, [LIST]: reply });

    renderPage();

    expect(await screen.findByText(message, undefined, { timeout: 6000 })).toBeTruthy();
    expect(screen.queryByRole('list', { name: 'Notifications' })).toBeNull();
  }, 10_000);

  it('traduit l’échec du marquage', async () => {
    stubApi({
      [COUNT]: { body: unreadCount },
      [LIST]: { body: listUnread },
      [`POST /api/v1/notifications/${OVERDUE_ID}/read`]: { status: 429, body: problem(429, 'too_many_requests') },
    });

    const { user } = renderPage();

    await user.click(await screen.findByRole('button', { name: 'Marquer comme lue : Loyer en retard' }));

    expect(await screen.findByText('La mise à jour a échoué')).toBeTruthy();
    expect(screen.getByText(/Trop de demandes en peu de temps/)).toBeTruthy();
  });

  it('rejette une réponse inattendue du serveur', async () => {
    stubApi({ [COUNT]: { body: unreadCount }, [LIST]: { body: { data: [{ id: 1 }] } } });

    renderPage();

    expect(await screen.findByText('Le serveur a répondu de façon inattendue. Réessayez dans un instant.')).toBeTruthy();
  });

  it('est accessible', async () => {
    stubApi({ [COUNT]: { body: unreadCount }, [LIST]: paged });

    const { container } = renderPage();

    await screen.findByRole('list', { name: 'Notifications' });
    await expectNoA11yViolations(container);
  });
});
