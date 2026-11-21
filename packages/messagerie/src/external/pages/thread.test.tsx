import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError, ApiUnreachableError } from '@eguardimmo/api';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { detailOf, emptyPage, fakeSource, messageOf, renderExternal } from '../../../test/external';
import { ATTACHMENT_ID, FIRST_MESSAGE_ID, SECOND_MESSAGE_ID, THREAD_ID, messageFixture, ownMessageFixture } from '../testing';
import { NOT_A_NOTICE_TEXT } from '../copy';
import { ExternalThreadPage } from './ThreadPage';

const NOW = new Date('2026-11-19T09:10:00+00:00');

afterEach(() => {
  vi.useRealTimers();
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
});

describe('fil de conversation externe', () => {
  it('affiche les messages dans un journal à annonce polie, avec le nom servi du membre de l’équipe', async () => {
    const source = fakeSource({ getThread: () => Promise.resolve(detailOf({}, [messageFixture(), ownMessageFixture()])) });
    const { container } = renderExternal(<ExternalThreadPage threadId={THREAD_ID} />, { source });

    const log = await screen.findByRole('log', { name: 'Messages de la conversation' });
    expect(log.getAttribute('aria-live')).toBe('polite');
    const agency = within(log).getByRole('article', { name: 'Message de Camille Martin' });
    expect(agency.textContent).toContain('Agence · Agence des Tilleuls');
    expect(within(log).getByRole('article', { name: 'Message de Awa Koffi' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Quittance de novembre' })).toBeTruthy();
    expect(screen.getByText('Bail BAIL-2026-001')).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it('rend le texte comme du texte : aucun HTML injecté, mise en forme limitée au gras, italique et souligné', async () => {
    const hostile = '<img src=x onerror="window.pwned=1"><script>window.pwned=2</script> **gras** https://exemple.test/piege';
    const source = fakeSource({ getThread: () => Promise.resolve(detailOf({}, [messageFixture({ body: hostile })])) });
    renderExternal(<ExternalThreadPage threadId={THREAD_ID} />, { source });

    const log = await screen.findByRole('log');
    expect(log.querySelector('img')).toBeNull();
    expect(log.querySelector('script')).toBeNull();
    expect(log.querySelector('a')).toBeNull();
    expect(log.textContent).toContain('<img src=x onerror="window.pwned=1">');
    expect(Array.from(log.querySelectorAll('p strong'), (node) => node.textContent)).toEqual(['gras']);
    expect(log.textContent).toContain('https://exemple.test/piege');
  });

  it('montre un message retiré sans son contenu, et « Lu par l’agence » sous le dernier message envoyé lu', async () => {
    const source = fakeSource({
      getThread: () =>
        Promise.resolve(
          detailOf({ agency_last_read_at: '2026-11-19T09:06:00+00:00' }, [
            messageFixture({ id: FIRST_MESSAGE_ID, redacted: true, body: '[message retiré]', mine: true, author: { side: 'me', name: 'Awa Koffi' } }),
            ownMessageFixture(),
          ]),
        ),
    });
    renderExternal(<ExternalThreadPage threadId={THREAD_ID} />, { source });

    await screen.findByRole('log');
    expect(screen.getByText('Message retiré')).toBeTruthy();
    expect(screen.queryByText('[message retiré]')).toBeNull();
    expect(screen.getAllByText('Lu par l’agence')).toHaveLength(1);
  });

  it('marque la conversation lue à l’ouverture quand le dernier message vient de l’agence', async () => {
    const source = fakeSource();
    renderExternal(<ExternalThreadPage threadId={THREAD_ID} />, { source });

    await screen.findByRole('log');
    await waitFor(() => { expect(source.markThread).toHaveBeenCalledWith(THREAD_ID, { read: true }); });
    expect(source.markThread).toHaveBeenCalledTimes(1);
  });

  it('ne marque pas lue une conversation déjà lue', async () => {
    const source = fakeSource({ getThread: () => Promise.resolve(detailOf({ unread: false })) });
    renderExternal(<ExternalThreadPage threadId={THREAD_ID} />, { source });

    await screen.findByRole('log');
    expect(source.markThread).not.toHaveBeenCalled();
  });

  it('affiche l’état fermé sans compositeur et propose d’écrire un nouveau message', async () => {
    const source = fakeSource({ getThread: () => Promise.resolve(detailOf({ status: 'closed', can_reply: false })) });
    renderExternal(<ExternalThreadPage threadId={THREAD_ID} />, { source });

    expect(await screen.findByText('Conversation fermée')).toBeTruthy();
    expect(screen.queryByRole('form', { name: 'Répondre' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Écrire un nouveau message' }).getAttribute('href')).toBe('/messages/nouveau');
  });

  it('distingue une conversation restreinte par l’agence d’une conversation en lecture seule', async () => {
    const muted = fakeSource({ getThread: () => Promise.resolve(detailOf({ muted: true, can_reply: false })) });
    const first = renderExternal(<ExternalThreadPage threadId={THREAD_ID} />, { source: muted });
    expect(await screen.findByText('Envoi restreint')).toBeTruthy();
    first.unmount();

    const readOnly = fakeSource({ getThread: () => Promise.resolve(detailOf({ can_reply: false })) });
    renderExternal(<ExternalThreadPage threadId={THREAD_ID} />, { source: readOnly, space: 'owner' });
    expect(await screen.findByText('Lecture seule')).toBeTruthy();
    expect(screen.getByText(/Votre accès est en lecture seule/)).toBeTruthy();
    expect(screen.queryByRole('form', { name: 'Répondre' })).toBeNull();
  });

  it('affiche le motif d’échec quand le fil est introuvable', async () => {
    const source = fakeSource({ getThread: () => Promise.reject(new ApiError(404, 'conversation_not_found', 'brut')) });
    renderExternal(<ExternalThreadPage threadId={THREAD_ID} />, { source });

    expect(await screen.findByText('Cette conversation n’existe pas ou n’est plus accessible depuis votre espace.')).toBeTruthy();
  });

  describe('réponse', () => {
    it('envoie la réponse avec un client_id, vide le champ, ajoute le message et y replace le focus', async () => {
      const source = fakeSource({ postMessage: () => Promise.resolve(messageOf({ id: SECOND_MESSAGE_ID, mine: true, author: { side: 'me', name: 'Awa Koffi' }, body: 'Merci !' })) });
      renderExternal(<ExternalThreadPage threadId={THREAD_ID} />, { source });
      const user = userEvent.setup();

      const field = await screen.findByRole('textbox', { name: 'Votre réponse' });
      await user.type(field, 'Merci !');
      await user.click(screen.getByRole('button', { name: 'Envoyer' }));

      await waitFor(() => { expect(source.postMessage).toHaveBeenCalledTimes(1); });
      const [threadId, input] = source.postMessage.mock.calls[0] ?? [];
      expect(threadId).toBe(THREAD_ID);
      expect(input).toMatchObject({ body: 'Merci !', files: [] });
      expect(input?.clientId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/);
      await waitFor(() => { expect((field as HTMLTextAreaElement).value).toBe(''); });
      expect(await screen.findByRole('article', { name: 'Message de Awa Koffi' })).toBeTruthy();
      expect(document.activeElement).toBe(field);
    });

    it('rejoue le même client_id après un échec réseau, et en change si le texte est modifié', async () => {
      const post = vi.fn()
        .mockRejectedValueOnce(new ApiUnreachableError())
        .mockRejectedValueOnce(new ApiUnreachableError())
        .mockResolvedValueOnce(messageOf({ id: SECOND_MESSAGE_ID, mine: true, author: { side: 'me', name: 'Awa Koffi' } }));
      const source = fakeSource({ postMessage: post });
      renderExternal(<ExternalThreadPage threadId={THREAD_ID} />, { source });
      const user = userEvent.setup();

      const field = await screen.findByRole('textbox', { name: 'Votre réponse' });
      await user.type(field, 'Bonjour');
      await user.click(screen.getByRole('button', { name: 'Envoyer' }));
      expect(await screen.findByText(/injoignable/)).toBeTruthy();
      expect(screen.getByText(/enregistré qu’une seule fois/)).toBeTruthy();
      await user.click(screen.getByRole('button', { name: 'Envoyer' }));
      await waitFor(() => { expect(post).toHaveBeenCalledTimes(2); });
      await user.type(field, ' à tous');
      await user.click(screen.getByRole('button', { name: 'Envoyer' }));
      await waitFor(() => { expect(post).toHaveBeenCalledTimes(3); });

      const ids = post.mock.calls.map((call: unknown[]) => (call[1] as { clientId: string }).clientId);
      expect(ids[0]).toBe(ids[1]);
      expect(ids[2]).not.toBe(ids[0]);
      expect(post.mock.calls[2]?.[1]).toMatchObject({ body: 'Bonjour à tous' });
    });

    it('refuse un message vide sans appeler le serveur', async () => {
      const source = fakeSource();
      renderExternal(<ExternalThreadPage threadId={THREAD_ID} />, { source });
      const user = userEvent.setup();

      await user.click(await screen.findByRole('button', { name: 'Envoyer' }));

      expect(await screen.findByText('Saisissez votre message')).toBeTruthy();
      expect(source.postMessage).not.toHaveBeenCalled();
    });

    it('traduit le refus d’une conversation fermée entre-temps et conserve la saisie', async () => {
      const source = fakeSource({ postMessage: () => Promise.reject(new ApiError(409, 'conversation_closed', 'brut')) });
      renderExternal(<ExternalThreadPage threadId={THREAD_ID} />, { source });
      const user = userEvent.setup();

      const field = await screen.findByRole('textbox', { name: 'Votre réponse' });
      await user.type(field, 'Bonjour');
      await user.click(screen.getByRole('button', { name: 'Envoyer' }));

      expect(await screen.findByText(/L’agence a fermé cette conversation/)).toBeTruthy();
      expect((field as HTMLTextAreaElement).value).toBe('Bonjour');
    });

    it('joint un fichier et l’envoie, et aide côté client en refusant un type non accepté', async () => {
      const source = fakeSource();
      const { container } = renderExternal(<ExternalThreadPage threadId={THREAD_ID} />, { source });
      const user = userEvent.setup({ applyAccept: false });

      await screen.findByRole('textbox', { name: 'Votre réponse' });
      const input = container.querySelector<HTMLInputElement>('input[type="file"]');
      if (!input) throw new Error('Champ fichier introuvable');
      await user.upload(input, [new File(['x'], 'virus.exe', { type: 'application/x-msdownload' }), new File(['%PDF'], 'justificatif.pdf', { type: 'application/pdf' })]);

      expect(await screen.findByText(/« virus.exe » : seuls les PDF et les images/)).toBeTruthy();
      await user.type(screen.getByRole('textbox', { name: 'Votre réponse' }), 'Voici');
      await user.click(screen.getByRole('button', { name: 'Envoyer' }));

      await waitFor(() => { expect(source.postMessage).toHaveBeenCalled(); });
      expect(source.postMessage.mock.calls[0]?.[1].files.map((file) => file.name)).toEqual(['justificatif.pdf']);
    });

    it('rappelle qu’un message n’est pas un congé', async () => {
      renderExternal(<ExternalThreadPage threadId={THREAD_ID} />);
      await screen.findByRole('form', { name: 'Répondre' });
      expect(screen.getByText(NOT_A_NOTICE_TEXT)).toBeTruthy();
    });
  });

  describe('pièces jointes et retrait', () => {
    it('télécharge une pièce par la source et traduit l’échec', async () => {
      const download = vi.fn().mockRejectedValueOnce(new ApiError(404, 'attachment_not_found', 'brut')).mockResolvedValueOnce(undefined);
      const attachment = { id: ATTACHMENT_ID, name: 'quittance.pdf', mime_type: 'application/pdf', size_bytes: 2048 };
      const source = fakeSource({ getThread: () => Promise.resolve(detailOf({}, [messageFixture({ attachments: [attachment] })])), downloadAttachment: download });
      renderExternal(<ExternalThreadPage threadId={THREAD_ID} />, { source });
      const user = userEvent.setup();

      await user.click(await screen.findByRole('button', { name: 'Télécharger quittance.pdf' }));
      expect(await screen.findByText('Cette pièce jointe n’existe plus ou ne vous est plus accessible.')).toBeTruthy();
      await user.click(screen.getByRole('button', { name: 'Télécharger quittance.pdf' }));
      await waitFor(() => { expect(download).toHaveBeenCalledTimes(2); });
      expect(download).toHaveBeenLastCalledWith({ id: ATTACHMENT_ID, name: 'quittance.pdf', mimeType: 'application/pdf', sizeBytes: 2048 });
    });

    it('propose de retirer son message pendant 15 minutes seulement', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true, now: NOW });
      const source = fakeSource({ getThread: () => Promise.resolve(detailOf({}, [messageFixture(), ownMessageFixture()])) });
      renderExternal(<ExternalThreadPage threadId={THREAD_ID} />, { source });

      expect(await screen.findAllByRole('button', { name: 'Retirer ce message' })).toHaveLength(1);
      await act(async () => { await vi.advanceTimersByTimeAsync(11 * 60_000); });
      expect(screen.queryByRole('button', { name: 'Retirer ce message' })).toBeNull();
    });

    it('retire son message après confirmation et le remplace par la version du serveur', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true, now: NOW });
      const redacted = messageOf({ id: SECOND_MESSAGE_ID, mine: true, redacted: true, body: '[message retiré]', author: { side: 'me', name: 'Awa Koffi' } });
      const source = fakeSource({ getThread: () => Promise.resolve(detailOf({}, [messageFixture(), ownMessageFixture()])), redactMessage: () => Promise.resolve(redacted) });
      renderExternal(<ExternalThreadPage threadId={THREAD_ID} />, { source });
      const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });

      await user.click(await screen.findByRole('button', { name: 'Retirer ce message' }));
      await user.click(await screen.findByRole('button', { name: 'Retirer le message' }));

      await waitFor(() => { expect(source.redactMessage).toHaveBeenCalledWith(THREAD_ID, SECOND_MESSAGE_ID); });
      expect(await screen.findByText('Message retiré')).toBeTruthy();
      expect(screen.queryByText('Merci, je la télécharge.')).toBeNull();
    });

    it('charge les messages précédents avec le curseur du serveur', async () => {
      const older = messageOf({ id: '0193a5e1-0000-7000-8000-0000000000f0', body: 'Un tout premier message', sent_at: '2026-11-18T08:00:00+00:00' });
      const source = fakeSource({
        getThread: () => Promise.resolve({ ...detailOf(), hasEarlier: true, earlierCursor: 'older' }),
        listMessages: (_, query) => Promise.resolve(query.cursor === 'older' ? { ...emptyPage, items: [older] } : emptyPage),
      });
      renderExternal(<ExternalThreadPage threadId={THREAD_ID} />, { source });
      const user = userEvent.setup();

      await user.click(await screen.findByRole('button', { name: 'Voir les messages précédents' }));

      expect(await screen.findByText('Un tout premier message')).toBeTruthy();
      expect(source.listMessages).toHaveBeenCalledWith(THREAD_ID, { cursor: 'older' });
      expect(screen.queryByRole('button', { name: 'Voir les messages précédents' })).toBeNull();
    });
  });

  describe('archivage', () => {
    it('archive la conversation puis retourne à la boîte', async () => {
      const source = fakeSource();
      const { navigate } = renderExternal(<ExternalThreadPage threadId={THREAD_ID} />, { source });
      const user = userEvent.setup();

      await user.click(await screen.findByRole('button', { name: 'Archiver' }));

      await waitFor(() => { expect(source.markThread).toHaveBeenCalledWith(THREAD_ID, { archived: true }); });
      await waitFor(() => { expect(navigate).toHaveBeenCalledWith('/messages'); });
    });
  });

  describe('interrogation périodique', () => {
    it('interroge le fil toutes les 10 s après le dernier message connu et affiche les nouveaux messages', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true, now: NOW });
      const incoming = messageOf({ id: SECOND_MESSAGE_ID, body: 'Une réponse tardive de l’agence', sent_at: '2026-11-19T09:11:00+00:00' });
      const source = fakeSource({ listMessages: () => Promise.resolve({ ...emptyPage, items: [incoming], status: 'closed', canReply: false }) });
      renderExternal(<ExternalThreadPage threadId={THREAD_ID} />, { source });

      await screen.findByRole('log');
      await act(async () => { await vi.advanceTimersByTimeAsync(10_500); });

      expect(source.listMessages).toHaveBeenCalledWith(THREAD_ID, { after: FIRST_MESSAGE_ID });
      expect(await screen.findByText('Une réponse tardive de l’agence')).toBeTruthy();
      expect(await screen.findByText('Conversation fermée')).toBeTruthy();
    });

    it('ne marque pas lu un message arrivé pendant que l’onglet est caché', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true, now: NOW });
      const source = fakeSource({ getThread: () => Promise.resolve(detailOf({ unread: false })) });
      renderExternal(<ExternalThreadPage threadId={THREAD_ID} />, { source });
      await screen.findByRole('log');

      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      await act(async () => { await vi.advanceTimersByTimeAsync(35_000); });

      expect(source.listMessages).not.toHaveBeenCalled();
      expect(source.markThread).not.toHaveBeenCalled();
    });

    it('espace les interrogations après une erreur du serveur', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true, now: NOW });
      const source = fakeSource({ listMessages: () => Promise.reject(new ApiError(503, 'x', 'brut')) });
      renderExternal(<ExternalThreadPage threadId={THREAD_ID} />, { source });
      await screen.findByRole('log');

      await act(async () => { await vi.advanceTimersByTimeAsync(10_500); });
      expect(source.listMessages).toHaveBeenCalledTimes(1);
      await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
      expect(source.listMessages).toHaveBeenCalledTimes(1);
      await act(async () => { await vi.advanceTimersByTimeAsync(11_000); });
      expect(source.listMessages).toHaveBeenCalledTimes(2);
    });

    it('cesse d’interroger quand l’accès à la conversation est perdu', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true, now: NOW });
      const source = fakeSource({ listMessages: () => Promise.reject(new ApiError(404, 'conversation_not_found', 'brut')) });
      renderExternal(<ExternalThreadPage threadId={THREAD_ID} />, { source });
      await screen.findByRole('log');

      await act(async () => { await vi.advanceTimersByTimeAsync(10_500); });
      await act(async () => { await vi.advanceTimersByTimeAsync(120_000); });

      expect(source.listMessages).toHaveBeenCalledTimes(1);
    });
  });
});
