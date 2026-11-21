import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError, ApiUnreachableError } from '@eguardimmo/api';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../test/axe';
import { availabilityOf, detailOf, emptyMessagesPage, fakeSupportSource, messageOf, renderSupport, summaryOf } from '../../../test/support';
import { ATTACHMENT_ID, SECOND_MESSAGE_ID, SECOND_TICKET_ID, TICKET_ID, supportMessageFixture, supportReplyFixture } from '../testing';
import { SUPPORT_PRIVACY_TEXT } from '../copy';
import { SupportRequestsPage } from './BoardPage';
import { SupportNewRequestPage } from './NewRequestPage';
import { SupportTicketPage } from './TicketPage';

const NOW = new Date('2026-11-19T10:30:00+00:00');

afterEach(() => {
  vi.useRealTimers();
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
});

const answered = (overrides = {}) => detailOf({ status: 'waiting', updated_at: '2026-11-19T10:00:00+00:00', requester_last_read_at: '2026-11-19T09:00:00+00:00', ...overrides }, [supportMessageFixture(), supportReplyFixture()]);

describe('liste des demandes au support', () => {
  it('affiche les demandes, le statut serveur du support et la mention neutre', async () => {
    const source = fakeSupportSource({
      listTickets: () => Promise.resolve([summaryOf({ status: 'waiting', updated_at: '2026-11-19T10:00:00+00:00' }), summaryOf({ id: SECOND_TICKET_ID, reference: 'SUP-2026-0002', subject: 'Facture', status: 'resolved' })]),
      availability: () => Promise.resolve(availabilityOf(false)),
    });
    const { container } = renderSupport(<SupportRequestsPage />, { source });

    const list = await screen.findByRole('list', { name: 'Mes demandes' });
    expect(within(list).getAllByRole('link')).toHaveLength(2);
    expect(within(list).getAllByRole('link')[0]?.getAttribute('href')).toBe(`/support/${TICKET_ID}`);
    expect(await screen.findByText('Support hors ligne')).toBeTruthy();
    expect(screen.getByText(SUPPORT_PRIVACY_TEXT)).toBeTruthy();
    expect(screen.getByRole('link', { name: /Nouvelle demande/ }).getAttribute('href')).toBe('/support/nouvelle');
    await expectNoA11yViolations(container);
  });

  it('compte les réponses à lire et filtre par onglet', async () => {
    const source = fakeSupportSource({
      listTickets: () => Promise.resolve([summaryOf({ status: 'waiting', updated_at: '2026-11-19T10:00:00+00:00' }), summaryOf({ id: SECOND_TICKET_ID, subject: 'Facture', status: 'resolved' })]),
    });
    renderSupport(<SupportRequestsPage />, { source });
    const user = userEvent.setup();

    await screen.findByRole('list', { name: 'Mes demandes' });
    await user.click(screen.getByRole('tab', { name: /Réponses à lire/ }));
    expect(within(screen.getByRole('list', { name: 'Mes demandes' })).getAllByRole('link')).toHaveLength(1);
    expect(screen.getByText(/Réponse non lue/)).toBeTruthy();
    await user.click(screen.getByRole('tab', { name: 'Résolues' }));
    expect(screen.getByText('Facture')).toBeTruthy();
    expect(screen.queryByText('Quittance de novembre introuvable')).toBeNull();
  });

  it('affiche l’état vide et le motif d’échec', async () => {
    const first = renderSupport(<SupportRequestsPage />);
    expect(await screen.findByText('Aucune demande pour le moment')).toBeTruthy();
    first.unmount();

    const failing = fakeSupportSource({ listTickets: () => Promise.reject(new ApiError(503, 'unavailable', 'brut')) });
    renderSupport(<SupportRequestsPage />, { source: failing });
    expect(await screen.findByText(/momentanément indisponible/)).toBeTruthy();
  });

  it('signale une disponibilité inconnue sans bloquer la liste', async () => {
    const source = fakeSupportSource({ availability: () => Promise.reject(new ApiUnreachableError()) });
    renderSupport(<SupportRequestsPage />, { source });
    expect(await screen.findByText('Disponibilité du support inconnue')).toBeTruthy();
  });

  it('interroge la liste toutes les 30 s et arrête quand l’onglet est caché', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, now: NOW });
    const source = fakeSupportSource();
    renderSupport(<SupportRequestsPage />, { source });
    await screen.findByText('Aucune demande pour le moment');
    expect(source.listTickets).toHaveBeenCalledTimes(1);

    await act(async () => { await vi.advanceTimersByTimeAsync(30_500); });
    expect(source.listTickets).toHaveBeenCalledTimes(2);

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    await act(async () => { await vi.advanceTimersByTimeAsync(95_000); });
    expect(source.listTickets).toHaveBeenCalledTimes(2);
  });
});

describe('fil d’une demande', () => {
  it('affiche les échanges, le support sous son nom neutre et le statut', async () => {
    const source = fakeSupportSource({ getTicket: () => Promise.resolve(answered({ requester_last_read_at: '2026-11-19T10:05:00+00:00' })) });
    const { container } = renderSupport(<SupportTicketPage ticketId={TICKET_ID} />, { source });

    const log = await screen.findByRole('log', { name: 'Échanges avec le support' });
    expect(log.getAttribute('aria-live')).toBe('polite');
    expect(within(log).getByRole('article', { name: 'Message de Awa Koffi' })).toBeTruthy();
    expect(within(log).getByRole('article', { name: 'Message de Support eGuardImmo' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Quittance de novembre introuvable' })).toBeTruthy();
    expect(screen.getByText('Réponse du support', { selector: 'span, div' })).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it('rend le texte comme du texte, sans HTML ni lien actif', async () => {
    const hostile = '<img src=x onerror="window.pwned=1"><script>window.pwned=2</script> https://exemple.test/piege';
    const source = fakeSupportSource({ getTicket: () => Promise.resolve(detailOf({}, [supportMessageFixture({ body: hostile })])) });
    renderSupport(<SupportTicketPage ticketId={TICKET_ID} />, { source });

    const log = await screen.findByRole('log');
    expect(log.querySelector('img')).toBeNull();
    expect(log.querySelector('script')).toBeNull();
    expect(log.querySelector('a')).toBeNull();
    expect(log.textContent).toContain('<img src=x onerror="window.pwned=1">');
  });

  it('marque la demande lue à l’ouverture quand une réponse du support n’a pas été lue', async () => {
    const source = fakeSupportSource({ getTicket: () => Promise.resolve(answered()) });
    renderSupport(<SupportTicketPage ticketId={TICKET_ID} />, { source });

    await screen.findByRole('log');
    await waitFor(() => { expect(source.markRead).toHaveBeenCalledWith(TICKET_ID); });
    expect(source.markRead).toHaveBeenCalledTimes(1);
  });

  it('ne marque pas lue une demande déjà lue, ni sans réponse du support', async () => {
    const read = fakeSupportSource({ getTicket: () => Promise.resolve(answered({ requester_last_read_at: '2026-11-19T10:05:00+00:00' })) });
    const first = renderSupport(<SupportTicketPage ticketId={TICKET_ID} />, { source: read });
    await screen.findByRole('log');
    expect(read.markRead).not.toHaveBeenCalled();
    first.unmount();

    const untouched = fakeSupportSource();
    renderSupport(<SupportTicketPage ticketId={TICKET_ID} />, { source: untouched });
    await screen.findByRole('log');
    expect(untouched.markRead).not.toHaveBeenCalled();
  });

  it('ne marque pas lue une demande ouverte dans un onglet caché', async () => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    const source = fakeSupportSource({ getTicket: () => Promise.resolve(answered()) });
    renderSupport(<SupportTicketPage ticketId={TICKET_ID} />, { source });

    await screen.findByRole('log');
    expect(source.markRead).not.toHaveBeenCalled();
  });

  it('affiche « Lu par le support » sous le dernier message du demandeur lu', async () => {
    const source = fakeSupportSource({ getTicket: () => Promise.resolve(detailOf({ support_last_read_at: '2026-11-19T09:30:00+00:00' })) });
    renderSupport(<SupportTicketPage ticketId={TICKET_ID} />, { source });

    await screen.findByRole('log');
    expect(screen.getAllByText('Lu par le support')).toHaveLength(1);
  });

  it('affiche le motif d’échec quand la demande est introuvable', async () => {
    const source = fakeSupportSource({ getTicket: () => Promise.reject(new ApiError(404, 'ticket_not_found', 'brut')) });
    renderSupport(<SupportTicketPage ticketId={TICKET_ID} />, { source });
    expect(await screen.findByText('Cette demande n’existe pas ou ne vous concerne pas.')).toBeTruthy();
  });

  it('télécharge une pièce par la source et traduit l’échec', async () => {
    const attachment = { id: ATTACHMENT_ID, name: 'capture.png', mime_type: 'image/png', size_bytes: 2048 };
    const download = vi.fn().mockRejectedValueOnce(new ApiError(404, 'attachment_not_found', 'brut')).mockResolvedValueOnce(undefined);
    const source = fakeSupportSource({ getTicket: () => Promise.resolve(detailOf({}, [supportMessageFixture({ attachments: [attachment] })])), downloadAttachment: download });
    renderSupport(<SupportTicketPage ticketId={TICKET_ID} />, { source });
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Télécharger capture.png' }));
    expect(await screen.findByText(/n’existe plus|n’est plus accessible/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Télécharger capture.png' }));
    await waitFor(() => { expect(download).toHaveBeenCalledTimes(2); });
    expect(download.mock.calls[1]?.[0]).toMatchObject({ id: ATTACHMENT_ID, name: 'capture.png' });
  });

  describe('réponse', () => {
    it('envoie la réponse avec un client_id, vide le champ et y replace le focus', async () => {
      const updated = detailOf({}, [supportMessageFixture(), supportReplyFixture({ id: SECOND_MESSAGE_ID, author: { id: 'u', name: 'Awa Koffi', support: false }, body: 'Merci !' })]);
      const source = fakeSupportSource({ postMessage: () => Promise.resolve(updated) });
      renderSupport(<SupportTicketPage ticketId={TICKET_ID} />, { source });
      const user = userEvent.setup();

      const field = await screen.findByRole('textbox', { name: 'Votre message' });
      await user.type(field, 'Merci !');
      await user.click(screen.getByRole('button', { name: 'Envoyer' }));

      await waitFor(() => { expect(source.postMessage).toHaveBeenCalledTimes(1); });
      const [id, input] = source.postMessage.mock.calls[0] ?? [];
      expect(id).toBe(TICKET_ID);
      expect(input).toMatchObject({ body: 'Merci !', files: [] });
      expect(input?.clientId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/);
      await waitFor(() => { expect((field as HTMLTextAreaElement).value).toBe(''); });
      expect(await screen.findByText('Merci !')).toBeTruthy();
      expect(document.activeElement).toBe(field);
    });

    it('rejoue le même client_id après un échec réseau, et en change si le texte est modifié', async () => {
      const post = vi.fn()
        .mockRejectedValueOnce(new ApiUnreachableError())
        .mockRejectedValueOnce(new ApiUnreachableError())
        .mockResolvedValueOnce(detailOf());
      const source = fakeSupportSource({ postMessage: post });
      renderSupport(<SupportTicketPage ticketId={TICKET_ID} />, { source });
      const user = userEvent.setup();

      const field = await screen.findByRole('textbox', { name: 'Votre message' });
      await user.type(field, 'Bonjour');
      await user.click(screen.getByRole('button', { name: 'Envoyer' }));
      expect(await screen.findByText(/qu’une seule fois/)).toBeTruthy();
      await user.click(screen.getByRole('button', { name: 'Envoyer' }));
      await waitFor(() => { expect(post).toHaveBeenCalledTimes(2); });
      await user.type(field, ' à tous');
      await user.click(screen.getByRole('button', { name: 'Envoyer' }));
      await waitFor(() => { expect(post).toHaveBeenCalledTimes(3); });

      const ids = post.mock.calls.map((call: unknown[]) => (call[1] as { clientId: string }).clientId);
      expect(ids[0]).toBe(ids[1]);
      expect(ids[2]).not.toBe(ids[0]);
    });

    it('refuse un message vide sans appeler le serveur', async () => {
      const source = fakeSupportSource();
      renderSupport(<SupportTicketPage ticketId={TICKET_ID} />, { source });
      const user = userEvent.setup();

      await user.click(await screen.findByRole('button', { name: 'Envoyer' }));

      expect(await screen.findByText('Saisissez votre message')).toBeTruthy();
      expect(source.postMessage).not.toHaveBeenCalled();
    });

    it('annonce la réouverture possible sur une demande résolue', async () => {
      const source = fakeSupportSource({ getTicket: () => Promise.resolve(detailOf({ status: 'resolved' })) });
      renderSupport(<SupportTicketPage ticketId={TICKET_ID} />, { source });
      expect(await screen.findByText(/rouvre la demande, jusqu’à 14 jours/)).toBeTruthy();
    });

    it('traduit le refus après 14 jours, conserve la saisie et propose une nouvelle demande', async () => {
      const source = fakeSupportSource({
        getTicket: () => Promise.resolve(detailOf({ status: 'resolved' })),
        postMessage: () => Promise.reject(new ApiError(409, 'ticket_resolved', 'brut')),
      });
      renderSupport(<SupportTicketPage ticketId={TICKET_ID} />, { source });
      const user = userEvent.setup();

      const field = await screen.findByRole('textbox', { name: 'Votre message' });
      await user.type(field, 'Encore un souci');
      await user.click(screen.getByRole('button', { name: 'Envoyer' }));

      expect(await screen.findByText(/résolue depuis plus de 14 jours/)).toBeTruthy();
      expect((field as HTMLTextAreaElement).value).toBe('Encore un souci');
      expect(screen.getByRole('link', { name: 'Ouvrir une nouvelle demande' }).getAttribute('href')).toBe('/support/nouvelle');
    });

    it('joint un fichier accepté et refuse un type non accepté côté client', async () => {
      const source = fakeSupportSource();
      const { container } = renderSupport(<SupportTicketPage ticketId={TICKET_ID} />, { source });
      const user = userEvent.setup({ applyAccept: false });

      await screen.findByRole('textbox', { name: 'Votre message' });
      const input = container.querySelector<HTMLInputElement>('input[type="file"]');
      if (!input) throw new Error('Champ fichier introuvable');
      await user.upload(input, [new File(['x'], 'virus.exe', { type: 'application/x-msdownload' }), new File(['%PDF'], 'justificatif.pdf', { type: 'application/pdf' })]);
      expect(await screen.findByText(/« virus.exe »/)).toBeTruthy();
      await user.type(screen.getByRole('textbox', { name: 'Votre message' }), 'Voici');
      await user.click(screen.getByRole('button', { name: 'Envoyer' }));

      await waitFor(() => { expect(source.postMessage).toHaveBeenCalled(); });
      expect(source.postMessage.mock.calls[0]?.[1].files.map((file) => file.name)).toEqual(['justificatif.pdf']);
    });

    it('rappelle que le support ne lit jamais les conversations', async () => {
      renderSupport(<SupportTicketPage ticketId={TICKET_ID} />);
      await screen.findByRole('form', { name: 'Répondre au support' });
      expect(screen.getAllByText(SUPPORT_PRIVACY_TEXT).length).toBeGreaterThan(0);
    });
  });

  describe('interrogation périodique', () => {
    it('interroge après le dernier message connu toutes les 10 s et affiche la réponse, l’état et l’accusé', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true, now: NOW });
      const incoming = supportReplyFixture({ body: 'Une réponse tardive du support' });
      const source = fakeSupportSource({
        listMessages: () => Promise.resolve({ ...emptyMessagesPage, items: [messageOf(incoming)], status: 'resolved', supportLastReadAt: '2026-11-19T09:30:00+00:00' }),
      });
      renderSupport(<SupportTicketPage ticketId={TICKET_ID} />, { source });

      await screen.findByRole('log');
      await act(async () => { await vi.advanceTimersByTimeAsync(10_500); });

      expect(source.listMessages).toHaveBeenCalledWith(TICKET_ID, { after: supportMessageFixture().id });
      expect(await screen.findByText('Une réponse tardive du support')).toBeTruthy();
      expect(await screen.findByText('Résolue', { selector: 'span, div' })).toBeTruthy();
      expect(screen.getAllByText('Lu par le support')).toHaveLength(1);
    });

    it('cesse d’interroger onglet caché et espace les interrogations après une erreur', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true, now: NOW });
      const source = fakeSupportSource({ listMessages: () => Promise.reject(new ApiError(503, 'x', 'brut')) });
      renderSupport(<SupportTicketPage ticketId={TICKET_ID} />, { source });
      await screen.findByRole('log');

      await act(async () => { await vi.advanceTimersByTimeAsync(10_500); });
      expect(source.listMessages).toHaveBeenCalledTimes(1);
      await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
      expect(source.listMessages).toHaveBeenCalledTimes(1);
      await act(async () => { await vi.advanceTimersByTimeAsync(11_000); });
      expect(source.listMessages).toHaveBeenCalledTimes(2);

      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      await act(async () => { await vi.advanceTimersByTimeAsync(200_000); });
      expect(source.listMessages).toHaveBeenCalledTimes(2);
    });

    it('cesse d’interroger quand l’accès à la demande est perdu', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true, now: NOW });
      const source = fakeSupportSource({ listMessages: () => Promise.reject(new ApiError(404, 'ticket_not_found', 'brut')) });
      renderSupport(<SupportTicketPage ticketId={TICKET_ID} />, { source });
      await screen.findByRole('log');

      await act(async () => { await vi.advanceTimersByTimeAsync(10_500); });
      await act(async () => { await vi.advanceTimersByTimeAsync(120_000); });

      expect(source.listMessages).toHaveBeenCalledTimes(1);
    });
  });
});

describe('nouvelle demande', () => {
  it('ouvre la demande avec catégorie, sujet, message et client_id, puis ouvre le fil', async () => {
    const source = fakeSupportSource();
    const { navigate, container } = renderSupport(<SupportNewRequestPage />, { source });
    const user = userEvent.setup();

    await user.type(await screen.findByRole('textbox', { name: 'Sujet' }), 'Quittance manquante');
    await user.type(screen.getByRole('textbox', { name: 'Message' }), 'Je ne retrouve pas ma quittance.');
    await user.click(screen.getByRole('button', { name: 'Envoyer au support' }));

    await waitFor(() => { expect(source.openTicket).toHaveBeenCalledTimes(1); });
    const [input] = source.openTicket.mock.calls[0] ?? [];
    expect(input).toMatchObject({ category: 'other', subject: 'Quittance manquante', body: 'Je ne retrouve pas ma quittance.', files: [] });
    expect(input?.clientId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/);
    await waitFor(() => { expect(navigate).toHaveBeenCalledWith(`/support/${TICKET_ID}`); });
    expect(screen.queryByLabelText(/organisation|espace/i)).toBeNull();
    await expectNoA11yViolations(container);
  });

  it('refuse un sujet et un message vides sans appeler le serveur', async () => {
    const source = fakeSupportSource();
    renderSupport(<SupportNewRequestPage />, { source });
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Envoyer au support' }));

    expect(await screen.findByText('Saisissez un sujet')).toBeTruthy();
    expect(screen.getByText('Saisissez votre message')).toBeTruthy();
    expect(source.openTicket).not.toHaveBeenCalled();
  });

  it('rejoue le même client_id après un échec réseau', async () => {
    const open = vi.fn().mockRejectedValueOnce(new ApiUnreachableError()).mockResolvedValueOnce(detailOf());
    const source = fakeSupportSource({ openTicket: open });
    const { navigate } = renderSupport(<SupportNewRequestPage />, { source });
    const user = userEvent.setup();

    await user.type(await screen.findByRole('textbox', { name: 'Sujet' }), 'Sujet');
    await user.type(screen.getByRole('textbox', { name: 'Message' }), 'Texte');
    await user.click(screen.getByRole('button', { name: 'Envoyer au support' }));
    expect(await screen.findByText(/qu’une seule fois/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Envoyer au support' }));

    await waitFor(() => { expect(navigate).toHaveBeenCalled(); });
    const ids = open.mock.calls.map((call: unknown[]) => (call[0] as { clientId: string }).clientId);
    expect(ids[0]).toBe(ids[1]);
  });

  it('traduit la limite de débit et l’espace refusé, et garde la saisie', async () => {
    const source = fakeSupportSource({ openTicket: () => Promise.reject(new ApiError(429, 'too_many_requests', 'brut', {}, 60)) });
    renderSupport(<SupportNewRequestPage />, { source });
    const user = userEvent.setup();

    await user.type(await screen.findByRole('textbox', { name: 'Sujet' }), 'Sujet');
    await user.type(screen.getByRole('textbox', { name: 'Message' }), 'Texte');
    await user.click(screen.getByRole('button', { name: 'Envoyer au support' }));

    expect(await screen.findByText(/5 par heure, 20 par jour/)).toBeTruthy();
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Sujet' }).value).toBe('Sujet');
  });

  it('annule vers la liste', async () => {
    const { navigate } = renderSupport(<SupportNewRequestPage />);
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Annuler' }));
    expect(navigate).toHaveBeenCalledWith('/support');
  });
});
