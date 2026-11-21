import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@eguardimmo/api';
import { expectNoA11yViolations } from '../../../../test/axe';
import { consoleDetailOf, fakeConsoleSource, renderConsoleSupport } from '../../../../test/console';
import { toMessagesPage } from '../api/mapping';
import { OPERATOR_ID, OTHER_OPERATOR_ID, TICKET_ID, consoleMessagesResponse, noteMessageFixture, replyMessageFixture, requesterMessageFixture } from '../testing';
import { ConsoleSupportTicketPage } from './TicketPage';

const READ = { support_last_read_at: '2026-11-19T23:00:00+00:00' };

afterEach(() => {
  vi.useRealTimers();
});

const open = (overrides = {}, messages = [requesterMessageFixture(), replyMessageFixture(), noteMessageFixture()]) =>
  fakeConsoleSource({ getTicket: () => Promise.resolve(consoleDetailOf({ ...READ, ...overrides }, messages)) });

describe('fil de support, côté équipe', () => {
  it('distingue sans ambiguïté message, réponse envoyée et note interne', async () => {
    const { container } = renderConsoleSupport(<ConsoleSupportTicketPage ticketId={TICKET_ID} />, { source: open() });
    const note = await screen.findByRole('article', { name: 'Note interne de Camille Martin' });
    expect(within(note).getByText('Note interne : invisible pour le demandeur')).toBeTruthy();
    const reply = screen.getByRole('article', { name: 'Réponse de Camille Martin' });
    expect(within(reply).getByText('Réponse envoyée à Awa Koffi')).toBeTruthy();
    expect(within(reply).queryByText(/Note interne/)).toBeNull();
    const asked = screen.getByRole('article', { name: 'Message de Awa Koffi' });
    expect(within(asked).queryByText(/Note interne|Réponse envoyée/)).toBeNull();
    expect(note.className).toContain('border-dashed');
    expect(reply.className).not.toContain('border-dashed');
    await expectNoA11yViolations(container);
  });

  it('rend le contenu des messages en texte, sans interpréter de HTML', async () => {
    const hostile = requesterMessageFixture({ body: '<img src=x onerror=alert(1)><b>gras</b>' });
    renderConsoleSupport(<ConsoleSupportTicketPage ticketId={TICKET_ID} />, { source: open({}, [hostile]) });
    const text = await screen.findByText('<img src=x onerror=alert(1)><b>gras</b>');
    expect(text.querySelector('img, b')).toBeNull();
  });

  it('affiche « Lu par le demandeur » sur la dernière réponse publique seulement', async () => {
    renderConsoleSupport(<ConsoleSupportTicketPage ticketId={TICKET_ID} />, { source: open({ requester_last_read_at: '2026-11-19T10:30:00+00:00' }) });
    const reply = await screen.findByRole('article', { name: 'Réponse de Camille Martin' });
    expect(within(reply).getByText('Lu par le demandeur')).toBeTruthy();
    expect(within(screen.getByRole('article', { name: 'Note interne de Camille Martin' })).queryByText('Lu par le demandeur')).toBeNull();
    expect(screen.getAllByText('Lu par le demandeur')).toHaveLength(1);
  });

  it('n’affiche pas l’accusé quand le demandeur n’a pas lu', async () => {
    renderConsoleSupport(<ConsoleSupportTicketPage ticketId={TICKET_ID} />, { source: open({ requester_last_read_at: '2026-11-19T09:30:00+00:00' }) });
    await screen.findByRole('article', { name: 'Réponse de Camille Martin' });
    expect(screen.queryByText('Lu par le demandeur')).toBeNull();
  });

  it('marque la demande lue à l’ouverture quand le demandeur a écrit en dernier', async () => {
    const source = fakeConsoleSource({ getTicket: () => Promise.resolve(consoleDetailOf({ support_last_read_at: null })) });
    renderConsoleSupport(<ConsoleSupportTicketPage ticketId={TICKET_ID} />, { source });
    await waitFor(() => { expect(source.markRead).toHaveBeenCalledTimes(1); });
    expect(source.markRead).toHaveBeenCalledWith(TICKET_ID);
  });

  it('ne marque pas lue une demande déjà lue, ni quand l’onglet est caché', async () => {
    const read = open();
    renderConsoleSupport(<ConsoleSupportTicketPage ticketId={TICKET_ID} />, { source: read });
    await screen.findByRole('article', { name: 'Message de Awa Koffi' });
    expect(read.markRead).not.toHaveBeenCalled();
    const hidden = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    const source = fakeConsoleSource({ getTicket: () => Promise.resolve(consoleDetailOf({ support_last_read_at: null })) });
    renderConsoleSupport(<ConsoleSupportTicketPage ticketId={TICKET_ID} />, { source });
    await waitFor(() => { expect(source.getTicket).toHaveBeenCalled(); });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(source.markRead).not.toHaveBeenCalled();
    hidden.mockRestore();
  });

  it('envoie par défaut une réponse publique, avec client_id, puis vide le champ', async () => {
    const source = open();
    renderConsoleSupport(<ConsoleSupportTicketPage ticketId={TICKET_ID} />, { source });
    const form = await screen.findByRole('form', { name: 'Répondre au demandeur' });
    expect(within(form).getByText('Ce message sera envoyé à Awa Koffi et visible par lui.')).toBeTruthy();
    await userEvent.type(within(form).getByRole('textbox'), 'Corrigé, réessayez.');
    await userEvent.click(within(form).getByRole('button', { name: 'Envoyer au demandeur' }));
    await waitFor(() => { expect(source.postMessage).toHaveBeenCalledTimes(1); });
    expect(source.postMessage).toHaveBeenCalledWith(TICKET_ID, expect.objectContaining({ body: 'Corrigé, réessayez.', internal: false, files: [], clientId: expect.stringMatching(/^[0-9a-f-]{36}$/) as string }));
    await waitFor(() => { expect(within(screen.getByRole('form', { name: 'Répondre au demandeur' })).getByRole<HTMLTextAreaElement>('textbox').value).toBe(''); });
  });

  it('bascule en note interne : formulaire, phrase et bouton changent avant tout envoi', async () => {
    const source = open();
    renderConsoleSupport(<ConsoleSupportTicketPage ticketId={TICKET_ID} />, { source });
    await userEvent.click(await screen.findByRole('radio', { name: 'Note interne' }));
    const form = screen.getByRole('form', { name: 'Ajouter une note interne' });
    expect(within(form).getByText('Cette note n’est visible que par l’équipe : le demandeur ne la verra jamais.')).toBeTruthy();
    expect(within(form).queryByText(/sera envoyé à/)).toBeNull();
    expect(form.className).toContain('border-dashed');
    await userEvent.type(within(form).getByRole('textbox'), 'À surveiller.');
    await userEvent.click(within(form).getByRole('button', { name: 'Ajouter la note interne' }));
    await waitFor(() => { expect(source.postMessage).toHaveBeenCalledWith(TICKET_ID, expect.objectContaining({ body: 'À surveiller.', internal: true })); });
  });

  it('refuse un message vide', async () => {
    const source = open();
    renderConsoleSupport(<ConsoleSupportTicketPage ticketId={TICKET_ID} />, { source });
    await userEvent.click(await screen.findByRole('button', { name: 'Envoyer au demandeur' }));
    expect(await screen.findByText('Saisissez votre message')).toBeTruthy();
    expect(source.postMessage).not.toHaveBeenCalled();
  });

  it('rejoue le même client_id après une panne, en change quand le texte ou le mode change', async () => {
    const postMessage = vi.fn().mockRejectedValueOnce(new ApiError(503, 'unavailable', 'brut')).mockResolvedValue(consoleDetailOf());
    renderConsoleSupport(<ConsoleSupportTicketPage ticketId={TICKET_ID} />, { source: fakeConsoleSource({ getTicket: () => Promise.resolve(consoleDetailOf(READ)), postMessage }) });
    const send = async () => { await userEvent.click(screen.getByRole('button', { name: /Envoyer au demandeur|Ajouter la note interne/ })); };
    await userEvent.type(await screen.findByRole('textbox', { name: 'Votre réponse au demandeur' }), 'Bonjour');
    await send();
    expect(await screen.findByText(/ne sera enregistré qu’une seule fois/)).toBeTruthy();
    await send();
    await waitFor(() => { expect(postMessage).toHaveBeenCalledTimes(2); });
    const ids = postMessage.mock.calls.map((call: unknown[]) => (call[1] as { clientId: string }).clientId);
    expect(ids[1]).toBe(ids[0]);

    postMessage.mockRejectedValueOnce(new ApiError(503, 'unavailable', 'brut'));
    await userEvent.type(screen.getByRole('textbox', { name: 'Votre réponse au demandeur' }), 'Autre');
    await send();
    await screen.findByText(/ne sera enregistré qu’une seule fois/);
    await userEvent.click(screen.getByRole('radio', { name: 'Note interne' }));
    await send();
    await waitFor(() => { expect(postMessage).toHaveBeenCalledTimes(4); });
    const later = postMessage.mock.calls.map((call: unknown[]) => call[1] as { clientId: string; internal: boolean });
    expect(later[3]?.internal).toBe(true);
    expect(later[3]?.clientId).not.toBe(later[2]?.clientId);
  });

  it('traduit le refus d’un contenu différent pour un client_id déjà utilisé', async () => {
    const postMessage = vi.fn().mockRejectedValue(new ApiError(409, 'idempotency_key_reused', 'brut'));
    renderConsoleSupport(<ConsoleSupportTicketPage ticketId={TICKET_ID} />, { source: fakeConsoleSource({ getTicket: () => Promise.resolve(consoleDetailOf(READ)), postMessage }) });
    await userEvent.type(await screen.findByRole('textbox', { name: 'Votre réponse au demandeur' }), 'Bonjour');
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer au demandeur' }));
    expect(await screen.findByText(/contenu différent/)).toBeTruthy();
  });

  it('modifie statut, priorité et assignation, et s’assigne la demande', async () => {
    const source = open();
    renderConsoleSupport(<ConsoleSupportTicketPage ticketId={TICKET_ID} />, { source });
    await userEvent.click(await screen.findByRole('combobox', { name: /Statut/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Résolue' }));
    await waitFor(() => { expect(source.updateTicket).toHaveBeenLastCalledWith(TICKET_ID, { status: 'resolved' }); });
    await userEvent.click(screen.getByRole('combobox', { name: /Priorité/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Haute' }));
    await waitFor(() => { expect(source.updateTicket).toHaveBeenLastCalledWith(TICKET_ID, { priority: 'high' }); });
    await userEvent.click(screen.getByRole('button', { name: 'M’assigner la demande' }));
    await waitFor(() => { expect(source.updateTicket).toHaveBeenLastCalledWith(TICKET_ID, { assigneeId: OPERATOR_ID }); });
    await userEvent.click(screen.getByRole('combobox', { name: /Assignée à/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Hugo Bernard' }));
    await waitFor(() => { expect(source.updateTicket).toHaveBeenLastCalledWith(TICKET_ID, { assigneeId: OTHER_OPERATOR_ID }); });
  });

  it('traduit un assigné refusé par le serveur', async () => {
    const updateTicket = vi.fn().mockRejectedValue(new ApiError(422, 'assignee_not_operator', 'brut'));
    renderConsoleSupport(<ConsoleSupportTicketPage ticketId={TICKET_ID} />, { source: fakeConsoleSource({ getTicket: () => Promise.resolve(consoleDetailOf(READ)), updateTicket }) });
    await userEvent.click(await screen.findByRole('button', { name: 'M’assigner la demande' }));
    const alert = await screen.findByText('Action impossible');
    expect(alert).toBeTruthy();
    expect(screen.queryByText('brut')).toBeNull();
  });

  it('retire « M’assigner » quand la demande m’est déjà assignée', async () => {
    renderConsoleSupport(<ConsoleSupportTicketPage ticketId={TICKET_ID} />, { source: open({ assignee: { id: OPERATOR_ID, name: 'Camille Martin' } }) });
    await screen.findByRole('combobox', { name: /Assignée à/ });
    await waitFor(() => { expect(screen.queryByRole('button', { name: 'M’assigner la demande' })).toBeNull(); });
  });

  it('interroge les nouveaux messages toutes les 10 secondes à partir du dernier connu', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const incoming = requesterMessageFixture({ id: '0193a5e1-0000-7000-8000-0000000001e0', body: 'Merci, ça fonctionne.', sent_at: '2026-11-19T11:00:00+00:00' });
    const listMessages = vi.fn().mockResolvedValue(toMessagesPage(consoleMessagesResponse([incoming])));
    const source = fakeConsoleSource({ getTicket: () => Promise.resolve(consoleDetailOf(READ, [requesterMessageFixture(), noteMessageFixture()])), listMessages });
    renderConsoleSupport(<ConsoleSupportTicketPage ticketId={TICKET_ID} />, { source });
    await screen.findByRole('article', { name: 'Note interne de Camille Martin' });
    await act(async () => { await vi.advanceTimersByTimeAsync(10_500); });
    expect(listMessages).toHaveBeenCalledWith(TICKET_ID, { after: noteMessageFixture().id });
    expect(await screen.findByText('Merci, ça fonctionne.')).toBeTruthy();
  });

  it('n’interroge plus le fil quand l’onglet est caché', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const source = open();
    renderConsoleSupport(<ConsoleSupportTicketPage ticketId={TICKET_ID} />, { source });
    await screen.findByRole('article', { name: 'Message de Awa Koffi' });
    const hidden = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    fireEvent(document, new Event('visibilitychange'));
    await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
    const before = source.listMessages.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(source.listMessages.mock.calls.length).toBe(before);
    hidden.mockRestore();
  });

  it('télécharge une pièce jointe par la source console', async () => {
    const withFile = requesterMessageFixture({ attachments: [{ id: '0193a5e1-0000-7000-8000-0000000001a9', name: 'capture.png', mime_type: 'image/png', size_bytes: 2048 }] });
    const source = open({}, [withFile]);
    renderConsoleSupport(<ConsoleSupportTicketPage ticketId={TICKET_ID} />, { source });
    await userEvent.click(await screen.findByRole('button', { name: 'Télécharger capture.png' }));
    await waitFor(() => { expect(source.downloadAttachment).toHaveBeenCalledWith(expect.objectContaining({ id: '0193a5e1-0000-7000-8000-0000000001a9', name: 'capture.png' })); });
  });

  it('traduit l’échec du téléchargement d’une pièce introuvable', async () => {
    const withFile = requesterMessageFixture({ attachments: [{ id: '0193a5e1-0000-7000-8000-0000000001a9', name: 'capture.png', mime_type: 'image/png', size_bytes: 2048 }] });
    const source = open({}, [withFile]);
    source.downloadAttachment.mockRejectedValue(new ApiError(404, 'attachment_not_found', 'brut'));
    renderConsoleSupport(<ConsoleSupportTicketPage ticketId={TICKET_ID} />, { source });
    await userEvent.click(await screen.findByRole('button', { name: 'Télécharger capture.png' }));
    expect(await screen.findByText(/pièce jointe n’existe plus/)).toBeTruthy();
    expect(screen.queryByText('brut')).toBeNull();
  });

  it('traduit une demande introuvable et permet de réessayer', async () => {
    const getTicket = vi.fn().mockRejectedValueOnce(new ApiError(404, 'ticket_not_found', 'brut')).mockResolvedValue(consoleDetailOf(READ));
    renderConsoleSupport(<ConsoleSupportTicketPage ticketId={TICKET_ID} />, { source: fakeConsoleSource({ getTicket }) });
    expect(await screen.findByText(/n’existe pas/)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /Réessayer/ }));
    expect(await screen.findByRole('article', { name: 'Message de Awa Koffi' })).toBeTruthy();
  });

  it('affiche la mention de confidentialité des conversations', async () => {
    renderConsoleSupport(<ConsoleSupportTicketPage ticketId={TICKET_ID} />, { source: open() });
    expect((await screen.findAllByText(/Les conversations des utilisateurs ne sont jamais lisibles/)).length).toBeGreaterThan(0);
  });
});
