import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@eguardimmo/api';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import { fakeStaffSource, renderStaff, staffSummaryOf } from '../../../../test/staff';
import { MANDATE_ID, OWNER_PARTY_ID, THREAD_ID } from '../testing';
import { StaffInboxPage } from './InboxPage';

const SECOND_ID = '0193a5e1-0000-7000-8000-0000000001a2';
const awaiting = staffSummaryOf();
const answered = staffSummaryOf({
  id: SECOND_ID,
  subject: 'Réparation du volet',
  unread: false,
  awaiting_reply: false,
  status: 'closed',
  last_author_side: 'staff',
  last_author_name: 'Camille Martin',
  preview: 'Un artisan passe mardi',
  has_attachments: true,
  assignee: { id: 'u1', name: 'Zoé Adjovi' },
  muted_until: '2026-12-01T00:00:00+00:00',
});
const counts = { all: 2, awaiting: 1, unread: 1, sent: 1, archived: 0 };
const page = (items = [awaiting, answered]) => ({ items, hasMore: false, nextCursor: null, counts });

afterEach(() => {
  vi.useRealTimers();
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
});

describe('boîte des conversations externes côté agence', () => {
  it('liste les conversations locataires avec leur état, les compteurs d’onglets et de sections, sans erreur d’accessibilité', async () => {
    const source = fakeStaffSource({
      listThreads: () => Promise.resolve(page()),
      unread: () => Promise.resolve({ internal: 2, tenant: 3, owner: 0 }),
    });
    const { container } = renderStaff(<StaffInboxPage kind="tenant" />, { source });

    const list = await screen.findByRole('list', { name: 'Conversations' });
    const first = within(list).getByRole('link', { name: /Quittance de novembre/ });
    expect(first.getAttribute('href')).toBe(`/messages/fil/${THREAD_ID}`);
    expect(first.textContent).toContain('Non lu');
    expect(first.textContent).toContain('Awa Koffi');
    expect(first.textContent).toContain('BAIL-2026-001');
    expect(first.textContent).toContain('À répondre');
    const second = within(list).getByRole('link', { name: /Réparation du volet/ });
    expect(second.textContent).toContain('Fermée');
    expect(second.textContent).toContain('Restreinte');
    expect(second.textContent).toContain('Assignée à Zoé Adjovi');
    expect(second.textContent).toContain('Camille Martin : Un artisan passe mardi');
    expect(screen.getByRole('tab', { name: /À répondre/ }).textContent).toContain('1');
    const nav = screen.getByRole('navigation', { name: 'Types de conversation' });
    expect(await within(nav).findByRole('link', { name: /Locataires/ })).toHaveProperty('textContent', expect.stringContaining('3'));
    expect(within(nav).getByRole('link', { name: /Locataires/ }).getAttribute('aria-current')).toBe('page');
    expect(within(nav).getByRole('link', { name: /Équipe/ }).textContent).toContain('2');
    expect(within(nav).getByRole('link', { name: /Mandants/ }).getAttribute('href')).toBe('/messages?section=mandants');
    await expectNoA11yViolations(container);
  });

  it('lit la boîte du bon type et un onglet à la fois, puis vide proprement', async () => {
    const source = fakeStaffSource();
    renderStaff(<StaffInboxPage kind="owner" />, { source });
    const user = userEvent.setup();

    expect(await screen.findByText('Aucune conversation avec un mandant')).toBeTruthy();
    expect(source.listThreads).toHaveBeenCalledWith({ kind: 'owner', tab: 'all', search: '', perPage: 25 }, null);
    await user.click(screen.getByRole('tab', { name: /Non lus/ }));
    await waitFor(() => { expect(source.listThreads).toHaveBeenCalledWith(expect.objectContaining({ kind: 'owner', tab: 'unread' }), null); });
    await user.click(screen.getByRole('tab', { name: /Archivés/ }));
    await waitFor(() => { expect(source.listThreads).toHaveBeenCalledWith(expect.objectContaining({ tab: 'archived' }), null); });
    expect(await screen.findByText('Aucune conversation ici')).toBeTruthy();
  });

  it('affiche une référence de mandat pour un fil mandant', async () => {
    const owner = staffSummaryOf({ kind: 'owner', party: { id: OWNER_PARTY_ID, name: 'Indivision Roux' }, lease: null, mandate: { id: MANDATE_ID, reference: 'MAN-7' } });
    renderStaff(<StaffInboxPage kind="owner" />, { source: fakeStaffSource({ listThreads: () => Promise.resolve(page([owner])) }) });
    expect((await screen.findByRole('link', { name: /Indivision Roux/ })).textContent).toContain('Mandat MAN-7');
  });

  it('cherche après une courte pause, côté serveur', async () => {
    const source = fakeStaffSource();
    renderStaff(<StaffInboxPage kind="tenant" />, { source });
    const user = userEvent.setup();

    await user.type(await screen.findByRole('searchbox', { name: 'Rechercher une conversation' }), 'volet');

    await waitFor(() => { expect(source.listThreads).toHaveBeenCalledWith(expect.objectContaining({ search: 'volet' }), null); });
    expect(source.listThreads).not.toHaveBeenCalledWith(expect.objectContaining({ search: 'v' }), null);
    expect(await screen.findByText('Aucune conversation ne correspond à votre recherche')).toBeTruthy();
  });

  it('charge la page suivante avec le curseur du serveur', async () => {
    const source = fakeStaffSource({
      listThreads: (_, cursor) => Promise.resolve(cursor === null ? { ...page([awaiting]), hasMore: true, nextCursor: 'page-2' } : page([answered])),
    });
    renderStaff(<StaffInboxPage kind="tenant" />, { source });

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Afficher plus de conversations' }));

    expect(await screen.findByRole('link', { name: /Réparation du volet/ })).toBeTruthy();
    expect(source.listThreads).toHaveBeenLastCalledWith(expect.anything(), 'page-2');
  });

  it('marque lu et archive depuis le menu de la ligne', async () => {
    const source = fakeStaffSource({ listThreads: () => Promise.resolve(page([awaiting])) });
    renderStaff(<StaffInboxPage kind="tenant" />, { source });
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Actions pour Quittance de novembre' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Marquer comme lu' }));
    await waitFor(() => { expect(source.markThread).toHaveBeenCalledWith(THREAD_ID, { read: true }); });

    await user.click(screen.getByRole('button', { name: 'Actions pour Quittance de novembre' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Archiver' }));
    await waitFor(() => { expect(source.markThread).toHaveBeenCalledWith(THREAD_ID, { archived: true }); });
  });

  it('traduit un refus de rôle et propose de réessayer', async () => {
    const source = fakeStaffSource({ listThreads: () => Promise.reject(new ApiError(403, 'role_forbidden', 'brut')) });
    renderStaff(<StaffInboxPage kind="tenant" />, { source });
    expect(await screen.findByText(/Votre rôle ne permet pas cette action/)).toBeTruthy();
  });

  it('traduit une indisponibilité 503 sans afficher de liste vide', async () => {
    const source = fakeStaffSource({ listThreads: () => Promise.reject(new ApiError(503, 'unavailable', 'brut')) });
    renderStaff(<StaffInboxPage kind="tenant" />, { source });
    await screen.findByRole('button', { name: /Réessayer/ });
    expect(screen.queryByText('Aucune conversation avec un locataire')).toBeNull();
  });

  it('n’affiche pas la section mandants pour une organisation individuelle', async () => {
    renderStaff(<StaffInboxPage kind="tenant" />, { organizationKind: 'individual' });
    const nav = await screen.findByRole('navigation', { name: 'Types de conversation' });
    expect(within(nav).queryByRole('link', { name: /Mandants/ })).toBeNull();
    expect(within(nav).getByRole('link', { name: /Locataires/ })).toBeTruthy();
  });

  describe('interrogation périodique', () => {
    it('rafraîchit la boîte toutes les 30 secondes et le compteur toutes les 60 secondes', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const source = fakeStaffSource({ listThreads: () => Promise.resolve(page([awaiting])) });
      renderStaff(<StaffInboxPage kind="tenant" />, { source });
      await screen.findByRole('list', { name: 'Conversations' });
      const lists = source.listThreads.mock.calls.length;
      const unread = source.unread.mock.calls.length;

      await act(async () => { await vi.advanceTimersByTimeAsync(31_000); });
      expect(source.listThreads.mock.calls.length).toBe(lists + 1);
      expect(source.unread.mock.calls.length).toBe(unread);
      await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
      expect(source.unread.mock.calls.length).toBe(unread + 1);
    });

    it('suspend toute interrogation quand l’onglet est caché', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const source = fakeStaffSource({ listThreads: () => Promise.resolve(page([awaiting])) });
      renderStaff(<StaffInboxPage kind="tenant" />, { source });
      await screen.findByRole('list', { name: 'Conversations' });
      const lists = source.listThreads.mock.calls.length;
      const unread = source.unread.mock.calls.length;

      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      await act(async () => { await vi.advanceTimersByTimeAsync(180_000); });

      expect(source.listThreads.mock.calls.length).toBe(lists);
      expect(source.unread.mock.calls.length).toBe(unread);
    });

    it('ralentit après une erreur 429 en respectant Retry-After', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const listThreads = vi.fn().mockResolvedValueOnce(page([awaiting])).mockRejectedValue(new ApiError(429, 'too_many_requests', 'brut', {}, 200));
      renderStaff(<StaffInboxPage kind="tenant" />, { source: fakeStaffSource({ listThreads }) });
      await screen.findByRole('list', { name: 'Conversations' });

      await act(async () => { await vi.advanceTimersByTimeAsync(31_000); });
      expect(listThreads).toHaveBeenCalledTimes(2);
      await act(async () => { await vi.advanceTimersByTimeAsync(120_000); });
      expect(listThreads).toHaveBeenCalledTimes(2);
    });
  });
});
