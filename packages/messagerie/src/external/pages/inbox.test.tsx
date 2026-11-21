import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@eguardimmo/api';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { fakeSource, renderExternal, summaryOf } from '../../../test/external';
import { SECOND_THREAD_ID, THREAD_ID } from '../testing';
import { ExternalInboxPage } from './InboxPage';

const unreadThread = summaryOf();
const readThread = summaryOf({ id: SECOND_THREAD_ID, subject: 'Réparation du volet', unread: false, status: 'closed', last_author: 'me', preview: 'Merci beaucoup', has_attachments: true });

describe('boîte de réception externe', () => {
  it('liste les conversations avec leur état, sans erreur d’accessibilité', async () => {
    const source = fakeSource({
      listThreads: () => Promise.resolve({ items: [unreadThread, readThread], hasMore: false, nextCursor: null }),
      unreadCount: () => Promise.resolve(3),
    });
    const { container } = renderExternal(<ExternalInboxPage />, { source });

    const list = await screen.findByRole('list', { name: 'Conversations' });
    const first = within(list).getByRole('link', { name: /Quittance de novembre/ });
    expect(first.getAttribute('href')).toBe(`/messages/${THREAD_ID}`);
    expect(first.textContent).toContain('Non lu');
    expect(first.textContent).toContain('BAIL-2026-001');
    const second = within(list).getByRole('link', { name: /Réparation du volet/ });
    expect(second.textContent).toContain('Fermée');
    expect(second.textContent).toContain('Vous : Merci beaucoup');
    expect(screen.getByRole('link', { name: 'Nouveau message' }).getAttribute('href')).toBe('/messages/nouveau');
    expect(await screen.findByRole('tab', { name: /Non lues/ })).toHaveProperty('textContent', expect.stringContaining('3'));
    await expectNoA11yViolations(container);
  });

  it('demande les non lues puis les archivées au serveur et vide proprement', async () => {
    const source = fakeSource();
    renderExternal(<ExternalInboxPage />, { source });
    const user = userEvent.setup();

    expect(await screen.findByText('Aucune conversation')).toBeTruthy();
    await user.click(screen.getByRole('tab', { name: /Non lues/ }));
    await waitFor(() => { expect(source.listThreads).toHaveBeenCalledWith(expect.objectContaining({ unread: true, archived: false }), null); });
    await user.click(screen.getByRole('tab', { name: 'Archivées' }));
    await waitFor(() => { expect(source.listThreads).toHaveBeenCalledWith(expect.objectContaining({ unread: false, archived: true }), null); });
  });

  it('charge la page suivante avec le curseur du serveur', async () => {
    const source = fakeSource({
      listThreads: (_, cursor) =>
        Promise.resolve(cursor === null ? { items: [unreadThread], hasMore: true, nextCursor: 'page-2' } : { items: [readThread], hasMore: false, nextCursor: null }),
    });
    renderExternal(<ExternalInboxPage />, { source });
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Afficher plus de conversations' }));

    expect(await screen.findByRole('link', { name: /Réparation du volet/ })).toBeTruthy();
    expect(source.listThreads).toHaveBeenLastCalledWith(expect.anything(), 'page-2');
    expect(screen.queryByRole('button', { name: 'Afficher plus de conversations' })).toBeNull();
  });

  it('cherche sur le serveur après une courte pause', async () => {
    const source = fakeSource();
    renderExternal(<ExternalInboxPage />, { source });
    const user = userEvent.setup();

    await user.type(await screen.findByRole('searchbox', { name: 'Rechercher un message' }), 'volet');

    await waitFor(() => { expect(source.listThreads).toHaveBeenCalledWith(expect.objectContaining({ search: 'volet' }), null); });
  });

  it('archive depuis le menu de la ligne', async () => {
    const source = fakeSource({ listThreads: () => Promise.resolve({ items: [unreadThread], hasMore: false, nextCursor: null }) });
    renderExternal(<ExternalInboxPage />, { source });
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Actions pour Quittance de novembre' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Archiver' }));

    await waitFor(() => { expect(source.markThread).toHaveBeenCalledWith(THREAD_ID, { archived: true }); });
  });

  it('marque une conversation comme lue depuis le menu', async () => {
    const source = fakeSource({ listThreads: () => Promise.resolve({ items: [unreadThread], hasMore: false, nextCursor: null }) });
    renderExternal(<ExternalInboxPage />, { source });
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Actions pour Quittance de novembre' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Marquer comme lu' }));

    await waitFor(() => { expect(source.markThread).toHaveBeenCalledWith(THREAD_ID, { read: true }); });
  });

  it('affiche l’échec en français avec un bouton pour réessayer', async () => {
    let calls = 0;
    const source = fakeSource({
      listThreads: () => {
        calls += 1;
        return calls === 1 ? Promise.reject(new ApiError(503, 'x', 'brut')) : Promise.resolve({ items: [unreadThread], hasMore: false, nextCursor: null });
      },
    });
    renderExternal(<ExternalInboxPage />, { source });
    const user = userEvent.setup();

    expect(await screen.findByText('Impossible de charger les messages.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByRole('link', { name: /Quittance de novembre/ })).toBeTruthy();
  });

  it('filtre par bail ou par agence quand il y en a plusieurs', async () => {
    const source = fakeSource();
    const changes: (string | null)[] = [];
    const scope = { options: [{ id: 'a', label: 'Bail A' }, { id: 'b', label: 'Bail B' }], value: 'a', onChange: (id: string | null) => { changes.push(id); } };
    renderExternal(<ExternalInboxPage scope={scope} />, { source });

    await screen.findByText('Aucune conversation');
    expect(source.listThreads).toHaveBeenCalledWith(expect.objectContaining({ scopeId: 'a' }), null);
    const user = userEvent.setup();
    await user.click(screen.getByRole('combobox', { name: /Bail/ }));
    await user.click(await screen.findByRole('option', { name: 'Tous mes baux' }));
    expect(changes).toEqual([null]);
  });
  it('déduit le filtre des baux servis par les options d’écriture, et le masque avec un seul bail', async () => {
    const option = (id: string, agencyId: string, label: string) => ({ id, agencyId, agencyName: label, label });
    const source = fakeSource({ composeOptions: () => Promise.resolve([option('l1', 'a1', 'Agence A · Bail 1'), option('l2', 'a2', 'Agence B · Bail 2')]) });
    const first = renderExternal(<ExternalInboxPage />, { source });
    const user = userEvent.setup();

    await user.click(await screen.findByRole('combobox', { name: /Bail/ }));
    await user.click(await screen.findByRole('option', { name: 'Agence B · Bail 2' }));
    await waitFor(() => { expect(source.listThreads).toHaveBeenCalledWith(expect.objectContaining({ scopeId: 'l2' }), null); });
    first.unmount();

    const single = fakeSource({ composeOptions: () => Promise.resolve([option('l1', 'a1', 'Agence A · Bail 1')]) });
    renderExternal(<ExternalInboxPage />, { source: single });
    await screen.findByText('Aucune conversation');
    expect(screen.queryByRole('combobox', { name: /Bail/ })).toBeNull();
  });
});
