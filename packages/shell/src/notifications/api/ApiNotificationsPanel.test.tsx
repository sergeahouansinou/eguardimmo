import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { ApiNotificationsPanel } from './ApiNotificationsPanel';
import { useRequiredNotificationsApi } from './context';
import {
  ORGANIZATION_ID,
  listPage1,
  listPage2,
  listUnread,
  notificationNotFoundProblem,
  readAll,
  readOne,
  unauthenticatedProblem,
  unreadCount,
} from './responses.fixtures';
import { TestLink, renderWithApi, stubApi } from './testing';
import type { Reply } from './testing';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const COUNT = 'GET /api/v1/notifications/unread-count';
const LIST = 'GET /api/v1/notifications';
const READ_ONE = `POST /api/v1/notifications/${listPage2.data[0]?.id ?? ''}/read`;
const READ_ALL = 'POST /api/v1/notifications/read-all';
const CONFIG = { allHref: '/notifications', settingsHref: '/compte/notifications' };

function Bell({ onNavigate }: { onNavigate: (href: string) => void }) {
  return <ApiNotificationsPanel api={useRequiredNotificationsApi()} config={CONFIG} Link={TestLink} onNavigate={onNavigate} />;
}

function renderBell(organizationId: string | null = ORGANIZATION_ID) {
  const navigate = vi.fn();
  return { ...renderWithApi(<Bell onNavigate={navigate} />, organizationId), navigate };
}

const unreadItem = listPage2.data[0];
const countOf = (value: number) => ({ data: { unread: value } });
const pageWith = (items: unknown[]) => ({ data: items, meta: { next_cursor: null } });

describe('cloche de notifications en mode API', () => {
  it('affiche le compteur de non-lues du serveur et les dernières notifications à l’ouverture', async () => {
    stubApi({ [COUNT]: { body: unreadCount }, [LIST]: { body: listPage1 } });

    const { user } = renderBell();

    await user.click(await screen.findByRole('button', { name: 'Notifications, 2 non lues' }));
    const panel = await screen.findByRole('dialog', { name: 'Notifications' });
    const list = await within(panel).findByRole('list', { name: 'Dernières notifications' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(within(list).getByRole('link', { name: /Paiement annulé/ }).getAttribute('href')).toBe('/finances/encaissements');
    expect(within(list).getByRole('link', { name: /Pièce expirée/ }).getAttribute('href')).toBe('/conformite/01935a60-0000-7000-8000-000000000001');
    expect(within(panel).getByRole('link', { name: 'Voir toutes les notifications' }).getAttribute('href')).toBe('/notifications');
  });

  it('marque lue au clic, puis le compteur décrémente depuis le serveur', async () => {
    let unread = 2;
    const api = stubApi({
      [COUNT]: () => ({ body: countOf(unread) }),
      [LIST]: { body: pageWith(listPage2.data) },
      [READ_ONE]: () => {
        unread = 1;
        return { body: readOne };
      },
    });

    const { user } = renderBell();

    await user.click(await screen.findByRole('button', { name: 'Notifications, 2 non lues' }));
    await user.click(await screen.findByRole('link', { name: /Loyer en retard/ }));

    expect(await screen.findByRole('button', { name: 'Notifications, 1 non lues' })).toBeTruthy();
    expect(api.callsTo('POST', `/api/v1/notifications/${unreadItem?.id ?? ''}/read`)).toHaveLength(1);
  });

  it('ne rappelle pas le serveur pour une notification déjà lue', async () => {
    const api = stubApi({ [COUNT]: { body: unreadCount }, [LIST]: { body: listPage1 } });

    const { user } = renderBell();

    await user.click(await screen.findByRole('button', { name: 'Notifications, 2 non lues' }));
    await user.click(await screen.findByRole('link', { name: /Pièce expirée/ }));

    expect(api.calls.filter((call) => call.method === 'POST')).toEqual([]);
  });

  it('marque tout comme lu pour l’organisation courante', async () => {
    let unread = 2;
    const api = stubApi({
      [COUNT]: () => ({ body: countOf(unread) }),
      [LIST]: { body: listUnread },
      [READ_ALL]: () => {
        unread = 0;
        return { body: readAll };
      },
    });

    const { user } = renderBell();

    await user.click(await screen.findByRole('button', { name: 'Notifications, 2 non lues' }));
    await user.click(await screen.findByRole('button', { name: 'Tout marquer comme lu' }));

    expect(await screen.findByRole('button', { name: 'Notifications' })).toBeTruthy();
    expect(api.callsTo('POST', '/api/v1/notifications/read-all')[0]?.body).toEqual({ organization: ORGANIZATION_ID });
  });

  it('filtre les non-lues côté serveur', async () => {
    const api = stubApi({ [COUNT]: { body: unreadCount }, [LIST]: (call) => ({ body: call.search.get('unread') === '1' ? listUnread : listPage1 }) });

    const { user } = renderBell();

    await user.click(await screen.findByRole('button', { name: 'Notifications, 2 non lues' }));
    await user.click(await screen.findByRole('tab', { name: /Non lues/ }));

    await waitFor(() => { expect(api.callsTo('GET', '/api/v1/notifications').some((call) => call.search.get('unread') === '1')).toBe(true); });
    expect(await screen.findByRole('link', { name: /Loyer en retard/ })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Pièce expirée/ })).toBeNull();
  });

  it('passe l’organisation courante au serveur, et aucune pour le locataire', async () => {
    const agency = stubApi({ [COUNT]: { body: unreadCount } });
    renderBell(ORGANIZATION_ID);
    await screen.findByRole('button', { name: 'Notifications, 2 non lues' });
    expect(agency.callsTo('GET', '/api/v1/notifications/unread-count')[0]?.search.get('organization')).toBe(ORGANIZATION_ID);

    const tenant = stubApi({ [COUNT]: { body: unreadCount } });
    renderBell(null);
    await waitFor(() => { expect(tenant.callsTo('GET', '/api/v1/notifications/unread-count').length).toBeGreaterThan(0); });
    expect(tenant.callsTo('GET', '/api/v1/notifications/unread-count')[0]?.search.has('organization')).toBe(false);
  });

  it.each([
    ['https://evil.example/hameçon', 'URL externe'],
    ['javascript:alert(1)', 'pseudo-URL javascript'],
    ['//evil.example/x', 'URL sans schéma'],
  ])('ne suit jamais %s (%s) : pas de lien, simple marquage lu', async (href) => {
    const hostile = { ...listPage2.data[0], href };
    const api = stubApi({
      [COUNT]: { body: unreadCount },
      [LIST]: { body: pageWith([hostile]) },
      [READ_ONE]: { body: readOne },
    });

    const { user } = renderBell();

    await user.click(await screen.findByRole('button', { name: 'Notifications, 2 non lues' }));
    const panel = await screen.findByRole('dialog', { name: 'Notifications' });
    const entry = await within(panel).findByRole('button', { name: /Loyer en retard/ });
    expect(within(panel).queryByRole('link', { name: /Loyer en retard/ })).toBeNull();
    expect(panel.querySelector(`a[href="${href}"]`)).toBeNull();
    await user.click(entry);

    await waitFor(() => { expect(api.callsTo('POST', `/api/v1/notifications/${unreadItem?.id ?? ''}/read`)).toHaveLength(1); });
  });

  it('n’affiche aucun compteur quand le serveur refuse, et traduit l’erreur dans la liste', async () => {
    stubApi({ [COUNT]: { status: 401, body: unauthenticatedProblem }, [LIST]: { status: 429, body: { ...unauthenticatedProblem, code: 'too_many_requests', status: 429 }, } });

    const { user } = renderBell();

    await user.click(await screen.findByRole('button', { name: 'Notifications' }));
    const panel = await screen.findByRole('dialog', { name: 'Notifications' });
    expect(await within(panel).findByText(/Trop de demandes en peu de temps/)).toBeTruthy();
  });

  it.each([
    ['401', { status: 401, body: unauthenticatedProblem }, 'Votre session a expiré. Reconnectez-vous pour continuer.'],
    ['403', { status: 403, body: { ...unauthenticatedProblem, status: 403, code: 'forbidden' } }, 'Vous n’avez pas le droit d’effectuer cette action.'],
    ['réseau', { network: true }, 'Le serveur est injoignable. Vérifiez votre connexion et réessayez.'],
  ] as [string, Reply, string][])('traduit l’erreur %s de la liste en français', async (_name, reply, message) => {
    stubApi({ [COUNT]: { body: unreadCount }, [LIST]: reply });

    const { user } = renderBell();

    await user.click(await screen.findByRole('button', { name: 'Notifications, 2 non lues' }));
    expect(await screen.findByText(message, undefined, { timeout: 6000 })).toBeTruthy();
  }, 10_000);

  it('traduit l’échec du marquage en lot', async () => {
    stubApi({ [COUNT]: { body: unreadCount }, [LIST]: { body: listUnread }, [READ_ALL]: { status: 429, body: { status: 429, code: 'too_many_requests' } } });

    const { user } = renderBell();

    await user.click(await screen.findByRole('button', { name: 'Notifications, 2 non lues' }));
    await user.click(await screen.findByRole('button', { name: 'Tout marquer comme lu' }));

    expect(await screen.findByText('Les notifications n’ont pas pu être marquées comme lues')).toBeTruthy();
  });

  it('rafraîchit le compteur à intervalle raisonnable, pas en boucle serrée', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let unread = 1;
    const api = stubApi({ [COUNT]: () => ({ body: countOf(unread) }) });

    renderBell();
    await screen.findByRole('button', { name: 'Notifications, 1 non lues' });
    expect(api.callsTo('GET', '/api/v1/notifications/unread-count')).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(30_000);
    expect(api.callsTo('GET', '/api/v1/notifications/unread-count')).toHaveLength(1);

    unread = 4;
    await vi.advanceTimersByTimeAsync(31_000);
    expect(await screen.findByRole('button', { name: 'Notifications, 4 non lues' })).toBeTruthy();
    expect(api.callsTo('GET', '/api/v1/notifications/unread-count')).toHaveLength(2);
  });

  it('cesse d’interroger en boucle une fois le serveur en erreur', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const api = stubApi({ [COUNT]: { status: 429, body: { status: 429, code: 'too_many_requests' } } });

    renderBell();
    await waitFor(() => { expect(api.callsTo('GET', '/api/v1/notifications/unread-count')).toHaveLength(1); });
    await vi.advanceTimersByTimeAsync(300_000);

    expect(api.callsTo('GET', '/api/v1/notifications/unread-count')).toHaveLength(1);
  });

  it('rafraîchit le compteur au retour au premier plan', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let unread = 1;
    const api = stubApi({ [COUNT]: () => ({ body: countOf(unread) }) });

    renderBell();
    await screen.findByRole('button', { name: 'Notifications, 1 non lues' });
    await vi.advanceTimersByTimeAsync(20_000);
    unread = 3;
    document.dispatchEvent(new Event('visibilitychange', { bubbles: true }));

    expect(await screen.findByRole('button', { name: 'Notifications, 3 non lues' })).toBeTruthy();
    expect(api.callsTo('GET', '/api/v1/notifications/unread-count')).toHaveLength(2);
  });

  it('est accessible, bulle ouverte', async () => {
    stubApi({ [COUNT]: { body: unreadCount }, [LIST]: { body: listPage1 } });

    const { user } = renderBell();

    await user.click(await screen.findByRole('button', { name: 'Notifications, 2 non lues' }));
    const panel = await screen.findByRole('dialog', { name: 'Notifications' });
    await within(panel).findByRole('list', { name: 'Dernières notifications' });
    await expectNoA11yViolations(panel);
  });

  it('une 404 au marquage rafraîchit la liste sans erreur bloquante', async () => {
    stubApi({ [COUNT]: { body: unreadCount }, [LIST]: { body: pageWith(listPage2.data) }, [READ_ONE]: { status: 404, body: notificationNotFoundProblem } });

    const { user } = renderBell();

    await user.click(await screen.findByRole('button', { name: 'Notifications, 2 non lues' }));
    await user.click(await screen.findByRole('link', { name: /Loyer en retard/ }));

    expect(await screen.findByRole('button', { name: 'Notifications, 2 non lues' })).toBeTruthy();
  });
});
