import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@eguardimmo/api';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import { emptyStaffPage, fakeStaffSource, proofStub, renderStaff, staffDetailOf, staffMessageOf } from '../../../../test/staff';
import { NOT_A_NOTICE_TEXT } from '../../copy';
import { ATTACHMENT_ID, FIRST_MESSAGE_ID, OTHER_STAFF_ID, SECOND_MESSAGE_ID, THREAD_ID, ownStaffMessageFixture, staffMessageFixture } from '../testing';
import { StaffThreadPage } from './ThreadPage';

const NOW = new Date('2026-11-19T09:10:00+00:00');
const twoMessages = [staffMessageFixture(), ownStaffMessageFixture()];

afterEach(() => {
  vi.useRealTimers();
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
});

describe('fil externe côté agence', () => {
  it('affiche les messages dans un journal à annonce polie, sans erreur d’accessibilité', async () => {
    const source = fakeStaffSource({ getThread: () => Promise.resolve(staffDetailOf({}, twoMessages)) });
    const { container } = renderStaff(<StaffThreadPage threadId={THREAD_ID} />, { source });

    const log = await screen.findByRole('log', { name: 'Messages de la conversation' });
    expect(log.getAttribute('aria-live')).toBe('polite');
    expect(within(log).getByRole('article', { name: 'Message de Awa Koffi' }).textContent).toContain('Locataire');
    expect(within(log).getByRole('article', { name: 'Message de Camille Martin' }).textContent).toContain('Équipe');
    expect(screen.getByRole('heading', { level: 1, name: 'Quittance de novembre' })).toBeTruthy();
    expect(screen.getByText('Bail BAIL-2026-001')).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it('laisse la pastille de mandat et le sous-titre se couper quand la référence est très longue', async () => {
    const longReference = 'MANDAT-GESTION-2026-0001-AVENANT-SIGNE-PAR-LE-MANDANT-EN-PRESENCE-DU-GERANT';
    const source = fakeStaffSource({
      getThread: () => Promise.resolve(staffDetailOf({ kind: 'owner', lease: null, mandate: { id: THREAD_ID, reference: longReference } }, twoMessages)),
    });
    renderStaff(<StaffThreadPage threadId={THREAD_ID} />, { source });

    const badge = await screen.findByText(`Mandat ${longReference}`);
    expect(badge.className).toContain('[overflow-wrap:anywhere]');
    expect(badge.className).not.toContain('whitespace-nowrap');
    expect(screen.getByRole('heading', { level: 1 }).className).toContain('[overflow-wrap:anywhere]');
  });

  it('rend le texte comme du texte : aucun HTML injecté', async () => {
    const hostile = '<img src=x onerror="window.pwned=1"><script>window.pwned=2</script> **gras**';
    const source = fakeStaffSource({ getThread: () => Promise.resolve(staffDetailOf({}, [staffMessageFixture({ body: hostile })])) });
    renderStaff(<StaffThreadPage threadId={THREAD_ID} />, { source });

    const log = await screen.findByRole('log');
    expect(log.querySelector('img')).toBeNull();
    expect(log.querySelector('script')).toBeNull();
    expect(log.textContent).toContain('<img src=x onerror="window.pwned=1">');
    expect(Array.from(log.querySelectorAll('p strong'), (node) => node.textContent)).toEqual(['gras']);
  });

  it('montre un message retiré avec son motif et sans son contenu', async () => {
    const redacted = staffMessageFixture({ redacted: true, body: '', redaction_reason: 'Pièce d’identité envoyée par erreur' });
    const source = fakeStaffSource({ getThread: () => Promise.resolve(staffDetailOf({}, [redacted])) });
    renderStaff(<StaffThreadPage threadId={THREAD_ID} />, { source });

    await screen.findByRole('log');
    expect(screen.getByText('Message retiré')).toBeTruthy();
    expect(screen.getByText('Motif : Pièce d’identité envoyée par erreur')).toBeTruthy();
  });

  it('affiche « Lu par le locataire » sous le dernier message de l’équipe lu par la contrepartie, « Lu par le mandant » côté mandant', async () => {
    const readAt = '2026-11-19T09:06:00+00:00';
    const tenant = fakeStaffSource({ getThread: () => Promise.resolve(staffDetailOf({ counterpart_last_read_at: readAt }, twoMessages)) });
    const first = renderStaff(<StaffThreadPage threadId={THREAD_ID} />, { source: tenant });
    await screen.findByRole('log');
    expect(screen.getAllByText('Lu par le locataire')).toHaveLength(1);
    first.unmount();

    const owner = fakeStaffSource({ getThread: () => Promise.resolve(staffDetailOf({ kind: 'owner', counterpart_last_read_at: readAt }, twoMessages)) });
    renderStaff(<StaffThreadPage threadId={THREAD_ID} />, { source: owner });
    await screen.findByRole('log');
    expect(screen.getAllByText('Lu par le mandant')).toHaveLength(1);
  });

  it('n’affiche pas d’accusé de lecture tant que la contrepartie n’a pas lu', async () => {
    const source = fakeStaffSource({ getThread: () => Promise.resolve(staffDetailOf({ counterpart_last_read_at: null }, twoMessages)) });
    renderStaff(<StaffThreadPage threadId={THREAD_ID} />, { source });
    await screen.findByRole('log');
    expect(screen.queryByText(/Lu par le/)).toBeNull();
  });

  it('marque la conversation lue à l’ouverture quand le dernier message vient de la contrepartie', async () => {
    const source = fakeStaffSource();
    renderStaff(<StaffThreadPage threadId={THREAD_ID} />, { source });

    await screen.findByRole('log');
    await waitFor(() => { expect(source.markThread).toHaveBeenCalledWith(THREAD_ID, { read: true }); });
    expect(source.markThread).toHaveBeenCalledTimes(1);
  });

  it('ne marque pas lu un fil déjà lu ni un fil ouvert dans un onglet caché', async () => {
    const read = fakeStaffSource({ getThread: () => Promise.resolve(staffDetailOf({ unread: false })) });
    const first = renderStaff(<StaffThreadPage threadId={THREAD_ID} />, { source: read });
    await screen.findByRole('log');
    expect(read.markThread).not.toHaveBeenCalled();
    first.unmount();

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    const hidden = fakeStaffSource();
    renderStaff(<StaffThreadPage threadId={THREAD_ID} />, { source: hidden });
    await screen.findByRole('log');
    expect(hidden.markThread).not.toHaveBeenCalled();
  });

  it('marque lu explicitement par le bouton, présent seulement sur un fil non lu', async () => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    const source = fakeStaffSource();
    renderStaff(<StaffThreadPage threadId={THREAD_ID} />, { source });
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Marquer comme lu' }));

    await waitFor(() => { expect(source.markThread).toHaveBeenCalledWith(THREAD_ID, { read: true }); });
    await waitFor(() => { expect(screen.queryByRole('button', { name: 'Marquer comme lu' })).toBeNull(); });
  });

  it('affiche l’échec traduit quand le fil est introuvable', async () => {
    const source = fakeStaffSource({ getThread: () => Promise.reject(new ApiError(404, 'conversation_not_found', 'brut')) });
    renderStaff(<StaffThreadPage threadId={THREAD_ID} />, { source });
    expect(await screen.findByText('Cette conversation n’existe pas ou n’est plus accessible.')).toBeTruthy();
  });

  describe('réponse', () => {
    it('envoie la réponse avec un client_id, vide le champ et ajoute le message', async () => {
      const sent = staffMessageOf({ id: SECOND_MESSAGE_ID, mine: true, author: { id: OTHER_STAFF_ID, name: 'Camille Martin', side: 'staff' }, body: 'Elle arrive aujourd’hui.' });
      let posted = false;
      const source = fakeStaffSource({
        postMessage: () => { posted = true; return Promise.resolve(sent); },
        getThread: () => Promise.resolve(staffDetailOf({}, posted ? [staffMessageFixture(), ownStaffMessageFixture()] : [staffMessageFixture()])),
      });
      renderStaff(<StaffThreadPage threadId={THREAD_ID} />, { source });
      const user = userEvent.setup();

      const field = await screen.findByRole('textbox', { name: 'Votre réponse' });
      await user.type(field, 'Elle arrive aujourd’hui.');
      await user.click(screen.getByRole('button', { name: 'Envoyer' }));

      await waitFor(() => { expect(source.postMessage).toHaveBeenCalledWith(THREAD_ID, expect.objectContaining({ body: 'Elle arrive aujourd’hui.', files: [], clientId: expect.stringMatching(/^[0-9a-f-]{36}$/) as string })); });
      await waitFor(() => { expect((field as HTMLTextAreaElement).value).toBe(''); });
      expect(await screen.findByText('Elle arrive aujourd’hui.')).toBeTruthy();
    });

    it('rejoue le même client_id après une panne, puis en change quand le texte change', async () => {
      const post = vi.fn().mockRejectedValueOnce(new ApiError(503, 'unavailable', 'brut')).mockRejectedValueOnce(new ApiError(503, 'unavailable', 'brut')).mockResolvedValue(staffMessageOf({ mine: true }));
      renderStaff(<StaffThreadPage threadId={THREAD_ID} />, { source: fakeStaffSource({ postMessage: post }) });
      const user = userEvent.setup();

      const field = await screen.findByRole('textbox', { name: 'Votre réponse' });
      await user.type(field, 'Bonjour');
      await user.click(screen.getByRole('button', { name: 'Envoyer' }));
      expect(await screen.findByText(/enregistré qu’une seule fois/)).toBeTruthy();
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
      const source = fakeStaffSource();
      renderStaff(<StaffThreadPage threadId={THREAD_ID} />, { source });
      await userEvent.setup().click(await screen.findByRole('button', { name: 'Envoyer' }));
      expect(await screen.findByText('Saisissez votre message')).toBeTruthy();
      expect(source.postMessage).not.toHaveBeenCalled();
    });

    it('traduit la restriction posée entre-temps et conserve la saisie', async () => {
      const source = fakeStaffSource({ postMessage: () => Promise.reject(new ApiError(403, 'conversation_muted', 'brut')) });
      renderStaff(<StaffThreadPage threadId={THREAD_ID} />, { source });
      const user = userEvent.setup();

      const field = await screen.findByRole('textbox', { name: 'Votre réponse' });
      await user.type(field, 'Bonjour');
      await user.click(screen.getByRole('button', { name: 'Envoyer' }));

      expect(await screen.findByText('L’envoi est restreint sur cette conversation.')).toBeTruthy();
      expect((field as HTMLTextAreaElement).value).toBe('Bonjour');
    });

    it('rappelle qu’un message n’est pas un congé', async () => {
      renderStaff(<StaffThreadPage threadId={THREAD_ID} />);
      await screen.findByRole('form', { name: 'Répondre' });
      expect(screen.getByText(NOT_A_NOTICE_TEXT)).toBeTruthy();
    });

    it('annonce que répondre à une conversation fermée la rouvre', async () => {
      const source = fakeStaffSource({ getThread: () => Promise.resolve(staffDetailOf({ status: 'closed' })) });
      renderStaff(<StaffThreadPage threadId={THREAD_ID} />, { source });
      expect(await screen.findByText('Cette conversation est fermée : votre réponse la rouvrira.')).toBeTruthy();
    });
  });

  describe('actions sur la conversation', () => {
    it('assigne à un membre de l’équipe puis retire l’assignation', async () => {
      const source = fakeStaffSource({ updateThread: () => Promise.resolve(staffDetailOf({ assignee: { id: OTHER_STAFF_ID, name: 'Zoé Adjovi' } })) });
      renderStaff(<StaffThreadPage threadId={THREAD_ID} />, { source });
      const user = userEvent.setup();

      await user.click(await screen.findByRole('combobox', { name: /Assignée à/ }));
      await user.click(await screen.findByRole('option', { name: 'Zoé Adjovi' }));

      await waitFor(() => { expect(source.updateThread).toHaveBeenCalledWith(THREAD_ID, { assigneeId: OTHER_STAFF_ID }); });
    });

    it('ferme puis rouvre la conversation en conservant les messages affichés', async () => {
      const source = fakeStaffSource({
        getThread: () => Promise.resolve(staffDetailOf({}, twoMessages)),
        updateThread: () => Promise.resolve(staffDetailOf({ status: 'closed' }, [])),
      });
      renderStaff(<StaffThreadPage threadId={THREAD_ID} />, { source });
      const user = userEvent.setup();

      await user.click(await screen.findByRole('button', { name: 'Fermer la conversation' }));

      await waitFor(() => { expect(source.updateThread).toHaveBeenCalledWith(THREAD_ID, { status: 'closed' }); });
      expect(await screen.findByRole('button', { name: 'Rouvrir la conversation' })).toBeTruthy();
      expect(screen.getAllByRole('article')).toHaveLength(2);
    });

    it('archive la conversation puis revient à la boîte', async () => {
      const source = fakeStaffSource();
      const { navigate } = renderStaff(<StaffThreadPage threadId={THREAD_ID} />, { source });
      const user = userEvent.setup();

      await user.click(await screen.findByRole('button', { name: 'Archiver' }));

      await waitFor(() => { expect(source.markThread).toHaveBeenCalledWith(THREAD_ID, { archived: true }); });
      await waitFor(() => { expect(navigate).toHaveBeenCalledWith('/messages'); });
    });

    it('revient à la boîte des mandants pour un fil mandant archivé', async () => {
      const source = fakeStaffSource({ getThread: () => Promise.resolve(staffDetailOf({ kind: 'owner', unread: false })) });
      const { navigate } = renderStaff(<StaffThreadPage threadId={THREAD_ID} />, { source });
      await userEvent.setup().click(await screen.findByRole('button', { name: 'Archiver' }));
      await waitFor(() => { expect(navigate).toHaveBeenCalledWith('/messages?section=mandants'); });
    });

    it('affiche l’échec traduit d’une assignation refusée', async () => {
      const source = fakeStaffSource({ updateThread: () => Promise.reject(new ApiError(422, 'assignee_invalid', 'brut')) });
      renderStaff(<StaffThreadPage threadId={THREAD_ID} />, { source });
      const user = userEvent.setup();

      await user.click(await screen.findByRole('combobox', { name: /Assignée à/ }));
      await user.click(await screen.findByRole('option', { name: 'Zoé Adjovi' }));

      expect(await screen.findByText(/membre actif de l’équipe/)).toBeTruthy();
    });
  });

  describe('retrait d’un message', () => {
    it('exige un motif à un administrateur, puis retire avec le motif', async () => {
      const redacted = staffMessageOf({ redacted: true, body: '', redaction_reason: 'Envoyé par erreur' });
      const source = fakeStaffSource({ redactMessage: () => Promise.resolve(redacted) });
      renderStaff(<StaffThreadPage threadId={THREAD_ID} />, { source });
      const user = userEvent.setup();

      await user.click(await screen.findByRole('button', { name: 'Retirer ce message' }));
      await user.click(await screen.findByRole('button', { name: 'Retirer le message' }));
      expect(await screen.findByText('Indiquez le motif du retrait (5 caractères au moins).')).toBeTruthy();
      expect(source.redactMessage).not.toHaveBeenCalled();

      await user.type(screen.getByRole('textbox', { name: /Motif du retrait/ }), 'Envoyé par erreur');
      await user.click(screen.getByRole('button', { name: 'Retirer le message' }));

      await waitFor(() => { expect(source.redactMessage).toHaveBeenCalledWith(THREAD_ID, FIRST_MESSAGE_ID, 'Envoyé par erreur'); });
      expect(await screen.findByText('Message retiré')).toBeTruthy();
    });

    it('rejoue le retrait après la preuve 2FA demandée par le serveur', async () => {
      const proof = proofStub();
      const redact = vi.fn().mockRejectedValueOnce(new ApiError(403, 'reauthentication_required', 'brut')).mockResolvedValue(staffMessageOf({ redacted: true, body: '' }));
      renderStaff(<StaffThreadPage threadId={THREAD_ID} />, { source: fakeStaffSource({ redactMessage: redact }), proof });
      const user = userEvent.setup();

      await user.click(await screen.findByRole('button', { name: 'Retirer ce message' }));
      await user.type(await screen.findByRole('textbox', { name: /Motif du retrait/ }), 'Donnée sensible');
      await user.click(screen.getByRole('button', { name: 'Retirer le message' }));

      await waitFor(() => { expect(proof.replays).toHaveLength(1); });
      expect(screen.queryByText(/Retrait impossible/)).toBeNull();
      expect(redact).toHaveBeenCalledTimes(1);
      act(() => { proof.replays[0]?.(); });
      await waitFor(() => { expect(redact).toHaveBeenCalledTimes(2); });
      expect(redact).toHaveBeenLastCalledWith(THREAD_ID, FIRST_MESSAGE_ID, 'Donnée sensible');
    });

    it('traduit le refus de retrait hors fenêtre', async () => {
      const source = fakeStaffSource({ redactMessage: () => Promise.reject(new ApiError(403, 'message_redaction_forbidden', 'brut')) });
      renderStaff(<StaffThreadPage threadId={THREAD_ID} />, { source });
      const user = userEvent.setup();

      await user.click(await screen.findByRole('button', { name: 'Retirer ce message' }));
      await user.type(await screen.findByRole('textbox', { name: /Motif du retrait/ }), 'Donnée sensible');
      await user.click(screen.getByRole('button', { name: 'Retirer le message' }));

      expect(await screen.findByText(/dans les 15 minutes/)).toBeTruthy();
    });

    it('un gestionnaire ne retire que son propre message, pendant 15 minutes', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true, now: NOW });
      const source = fakeStaffSource({ getThread: () => Promise.resolve(staffDetailOf({}, twoMessages)) });
      renderStaff(<StaffThreadPage threadId={THREAD_ID} />, { source, role: 'manager' });

      expect(await screen.findAllByRole('button', { name: 'Retirer ce message' })).toHaveLength(1);
      expect(within(screen.getByRole('article', { name: 'Message de Camille Martin' })).getByRole('button', { name: 'Retirer ce message' })).toBeTruthy();
      await act(async () => { await vi.advanceTimersByTimeAsync(11 * 60_000); });
      expect(screen.queryByRole('button', { name: 'Retirer ce message' })).toBeNull();
    });

    it('un gestionnaire retire son message sans motif obligatoire', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true, now: NOW });
      const source = fakeStaffSource({
        getThread: () => Promise.resolve(staffDetailOf({}, twoMessages)),
        redactMessage: () => Promise.resolve(staffMessageOf({ id: SECOND_MESSAGE_ID, mine: true, redacted: true, body: '' })),
      });
      renderStaff(<StaffThreadPage threadId={THREAD_ID} />, { source, role: 'manager' });
      const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });

      await user.click(await screen.findByRole('button', { name: 'Retirer ce message' }));
      await user.click(await screen.findByRole('button', { name: 'Retirer le message' }));

      await waitFor(() => { expect(source.redactMessage).toHaveBeenCalledWith(THREAD_ID, SECOND_MESSAGE_ID, null); });
    });
  });

  describe('restriction de l’envoi', () => {
    it('restreint avec une durée et un motif, après la preuve 2FA', async () => {
      const proof = proofStub();
      const restrict = vi
        .fn()
        .mockRejectedValueOnce(new ApiError(403, 'reauthentication_required', 'brut'))
        .mockResolvedValue(staffDetailOf({ muted_until: '2026-12-19T09:00:00+00:00', muted_reason: 'Messages répétés' }));
      renderStaff(<StaffThreadPage threadId={THREAD_ID} />, { source: fakeStaffSource({ restrict }), proof });
      const user = userEvent.setup();

      await user.click(await screen.findByRole('button', { name: 'Restreindre l’envoi' }));
      await user.click(screen.getByRole('button', { name: 'Restreindre' }));
      expect(await screen.findByText('Indiquez le motif de la restriction (5 caractères au moins).')).toBeTruthy();
      await user.type(screen.getByRole('textbox', { name: /Motif/ }), 'Messages répétés');
      await user.click(screen.getByRole('button', { name: 'Restreindre' }));

      await waitFor(() => { expect(proof.replays).toHaveLength(1); });
      act(() => { proof.replays[0]?.(); });
      await waitFor(() => { expect(restrict).toHaveBeenCalledTimes(2); });
      expect(restrict).toHaveBeenLastCalledWith(THREAD_ID, { days: 30, reason: 'Messages répétés' });
      expect(await screen.findByText('Envoi restreint')).toBeTruthy();
      expect(screen.getByText(/Motif : Messages répétés/)).toBeTruthy();
    });

    it('lève la restriction après confirmation', async () => {
      const source = fakeStaffSource({
        getThread: () => Promise.resolve(staffDetailOf({ muted_until: '2026-12-19T09:00:00+00:00', muted_reason: 'Messages répétés' })),
        lift: () => Promise.resolve(staffDetailOf()),
      });
      renderStaff(<StaffThreadPage threadId={THREAD_ID} />, { source });
      const user = userEvent.setup();

      await user.click(await screen.findByRole('button', { name: 'Lever la restriction' }));
      const dialog = await screen.findByRole('dialog');
      await user.click(within(dialog).getByRole('button', { name: 'Lever la restriction' }));

      await waitFor(() => { expect(source.lift).toHaveBeenCalledWith(THREAD_ID); });
      await waitFor(() => { expect(screen.queryByText('Envoi restreint')).toBeNull(); });
    });

    it('n’offre ni restriction ni levée à un gestionnaire', async () => {
      renderStaff(<StaffThreadPage threadId={THREAD_ID} />, { role: 'manager' });
      await screen.findByRole('log');
      expect(screen.queryByRole('button', { name: 'Restreindre l’envoi' })).toBeNull();
    });
  });

  it('télécharge une pièce par la source et traduit l’échec', async () => {
    const download = vi.fn().mockRejectedValueOnce(new ApiError(404, 'attachment_not_found', 'brut')).mockResolvedValueOnce(undefined);
    const attachment = { id: ATTACHMENT_ID, name: 'quittance.pdf', mime_type: 'application/pdf', size_bytes: 2048 };
    const source = fakeStaffSource({ getThread: () => Promise.resolve(staffDetailOf({}, [staffMessageFixture({ attachments: [attachment] })])), downloadAttachment: download });
    renderStaff(<StaffThreadPage threadId={THREAD_ID} />, { source });
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Télécharger quittance.pdf' }));
    expect(await screen.findByText('Cette pièce jointe n’existe plus ou ne vous est plus accessible.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Télécharger quittance.pdf' }));
    await waitFor(() => { expect(download).toHaveBeenCalledTimes(2); });
    expect(download).toHaveBeenLastCalledWith({ id: ATTACHMENT_ID, name: 'quittance.pdf', mimeType: 'application/pdf', sizeBytes: 2048 });
  });

  it('charge les messages précédents avec le curseur du serveur', async () => {
    const older = staffMessageOf({ id: '0193a5e1-0000-7000-8000-0000000001f0', body: 'Un tout premier message', sent_at: '2026-11-18T08:00:00+00:00' });
    const source = fakeStaffSource({
      getThread: () => Promise.resolve({ ...staffDetailOf(), hasEarlier: true, earlierCursor: 'older' }),
      listMessages: (_, query) => Promise.resolve(query.cursor === 'older' ? { ...emptyStaffPage, items: [older] } : emptyStaffPage),
    });
    renderStaff(<StaffThreadPage threadId={THREAD_ID} />, { source });

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Voir les messages précédents' }));

    expect(await screen.findByText('Un tout premier message')).toBeTruthy();
    expect(source.listMessages).toHaveBeenCalledWith(THREAD_ID, { cursor: 'older' });
    expect(screen.queryByRole('button', { name: 'Voir les messages précédents' })).toBeNull();
  });

  describe('interrogation périodique', () => {
    it('ajoute les nouveaux messages toutes les 10 secondes, après le dernier connu', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const incoming = staffMessageOf({ id: SECOND_MESSAGE_ID, body: 'Merci beaucoup', sent_at: '2026-11-19T09:20:00+00:00' });
      const source = fakeStaffSource({ listMessages: vi.fn().mockResolvedValue({ ...emptyStaffPage, items: [incoming] }) });
      renderStaff(<StaffThreadPage threadId={THREAD_ID} />, { source });
      await screen.findByRole('log');

      await act(async () => { await vi.advanceTimersByTimeAsync(10_500); });

      expect(await screen.findByText('Merci beaucoup')).toBeTruthy();
      expect(source.listMessages).toHaveBeenCalledWith(THREAD_ID, { after: FIRST_MESSAGE_ID });
    });

    it('s’arrête quand l’onglet est caché', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const source = fakeStaffSource();
      renderStaff(<StaffThreadPage threadId={THREAD_ID} />, { source });
      await screen.findByRole('log');

      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });

      expect(source.listMessages).not.toHaveBeenCalled();
    });

    it('espère davantage après une erreur 429 en respectant Retry-After', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const limited = new ApiError(429, 'too_many_requests', 'brut', {}, 120);
      const source = fakeStaffSource({ listMessages: vi.fn().mockRejectedValue(limited) });
      renderStaff(<StaffThreadPage threadId={THREAD_ID} />, { source });
      await screen.findByRole('log');

      await act(async () => { await vi.advanceTimersByTimeAsync(10_500); });
      expect(source.listMessages).toHaveBeenCalledTimes(1);
      await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
      expect(source.listMessages).toHaveBeenCalledTimes(1);
    });
  });
});
