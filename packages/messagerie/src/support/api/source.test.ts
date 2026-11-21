import { ApiError, buildUrl } from '@eguardimmo/api';
import type { ApiClient } from '@eguardimmo/api';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UnexpectedResponseError } from '../../external/api/errors';
import {
  ATTACHMENT_ID,
  ORGANIZATION_ID,
  SECOND_MESSAGE_ID,
  TICKET_ID,
  statusResponse,
  supportMessageFixture,
  supportReplyFixture,
  supportTicketFixture,
  ticketDetailResponse,
  ticketListResponse,
  ticketMessagesResponse,
} from '../testing';
import { describeSupportFailure, supportSendFailureMessage } from './errors';
import { createSupportApiSource } from './source';

function fakeClient(reply: unknown = {}): ApiClient & Record<'get' | 'post' | 'patch', ReturnType<typeof vi.fn>> {
  const respond = vi.fn(() => Promise.resolve(reply));
  return {
    baseUrl: 'http://api.test',
    get: respond,
    post: respond,
    put: respond,
    patch: respond,
    delete: respond,
    url: (path, query) => buildUrl('http://api.test', path, query),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('source API du support, côté demandeur', () => {
  it('lit les horaires et le statut en ligne sur le serveur', async () => {
    const client = fakeClient(statusResponse(false));
    const availability = await createSupportApiSource({ client, space: 'tenant' }).availability();

    expect(client.get).toHaveBeenCalledWith('/api/v1/support/status');
    expect(availability).toEqual({
      online: false,
      hoursLabel: 'Lun–ven 9 h – 18 h (Europe/Paris)',
      responseLabel: 'Réponse sous 1 jour ouvré',
      timezone: 'Europe/Paris',
      hours: [{ days: [1, 2, 3, 4, 5], from: '09:00', to: '18:00' }],
    });
  });

  it('liste les demandes avec les accusés de lecture et le nom de l’organisation', async () => {
    const client = fakeClient(ticketListResponse([supportTicketFixture({ space: 'organization', organization: 'Agence des Tilleuls', status: 'waiting', assignee: { id: null, name: 'Support eGuardImmo' } })]));
    const [ticket] = await createSupportApiSource({ client, space: 'organization', organizationId: ORGANIZATION_ID }).listTickets();

    expect(client.get).toHaveBeenCalledWith('/api/v1/support/tickets');
    expect(ticket).toMatchObject({ reference: 'SUP-2026-0001', organizationName: 'Agence des Tilleuls', status: 'waiting', handled: true, requesterLastReadAt: '2026-11-19T09:00:00+00:00', supportLastReadAt: null });
  });

  it('ouvre une demande avec l’espace du contexte, l’organisation et un client_id, en JSON sans pièce', async () => {
    const client = fakeClient(ticketDetailResponse(supportTicketFixture({ space: 'organization' })));
    const source = createSupportApiSource({ client, space: 'organization', organizationId: ORGANIZATION_ID });

    await source.openTicket({ category: 'billing', subject: 'Facture', body: 'Bonjour', files: [], clientId: 'client-1' });

    expect(client.post).toHaveBeenCalledWith('/api/v1/support/tickets', {
      space: 'organization',
      organization_id: ORGANIZATION_ID,
      category: 'billing',
      subject: 'Facture',
      body: 'Bonjour',
      client_id: 'client-1',
    });
  });

  it('n’envoie aucune organisation hors de l’espace organisation, et joint les pièces en formulaire', async () => {
    const client = fakeClient(ticketDetailResponse(supportTicketFixture()));
    const source = createSupportApiSource({ client, space: 'tenant', organizationId: ORGANIZATION_ID });
    const file = new File([new Uint8Array(10)], 'capture.png', { type: 'image/png' });

    await source.openTicket({ category: 'other', subject: 'Sujet', body: 'Texte', files: [file], clientId: 'client-2' });

    const [, body] = client.post.mock.calls[0] as [string, FormData];
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('space')).toBe('tenant');
    expect(body.has('organization_id')).toBe(false);
    expect(body.get('client_id')).toBe('client-2');
    expect(body.getAll('attachments[]')).toHaveLength(1);
  });

  it('refuse de créer une source d’organisation sans identifiant d’organisation', () => {
    expect(() => createSupportApiSource({ client: fakeClient(), space: 'organization' })).toThrow();
  });

  it('rend « Support eGuardImmo » pour le support et marque les messages du demandeur comme les siens', async () => {
    const client = fakeClient(ticketDetailResponse(supportTicketFixture(), [supportMessageFixture(), supportReplyFixture()]));
    const ticket = await createSupportApiSource({ client, space: 'tenant' }).getTicket(TICKET_ID);

    expect(client.get).toHaveBeenCalledWith(`/api/v1/support/tickets/${TICKET_ID}`);
    expect(ticket.messages.map((message) => [message.authorName, message.mine, message.fromSupport])).toEqual([
      ['Awa Koffi', true, false],
      ['Support eGuardImmo', false, true],
    ]);
  });

  it('poste une réponse avec client_id et renvoie la demande à jour', async () => {
    const client = fakeClient(ticketDetailResponse(supportTicketFixture(), [supportMessageFixture(), supportReplyFixture()]));
    const ticket = await createSupportApiSource({ client, space: 'tenant' }).postMessage(TICKET_ID, { body: 'Merci', files: [], clientId: 'client-3' });

    expect(client.post).toHaveBeenCalledWith(`/api/v1/support/tickets/${TICKET_ID}/messages`, { body: 'Merci', client_id: 'client-3' });
    expect(ticket.messages).toHaveLength(2);
  });

  it('lit les nouveaux messages après un repère, avec le statut et les accusés', async () => {
    const client = fakeClient(ticketMessagesResponse([supportReplyFixture()], { status: 'waiting', support_last_read_at: '2026-11-19T10:05:00+00:00', has_more: true }));
    const page = await createSupportApiSource({ client, space: 'tenant' }).listMessages(TICKET_ID, { after: SECOND_MESSAGE_ID });

    expect(client.get).toHaveBeenCalledWith(`/api/v1/support/tickets/${TICKET_ID}/messages`, { after: SECOND_MESSAGE_ID });
    expect(page).toMatchObject({ hasMore: true, status: 'waiting', supportLastReadAt: '2026-11-19T10:05:00+00:00' });
    expect(page.items).toHaveLength(1);
  });

  it('accuse la lecture par PATCH {read:true}', async () => {
    const client = fakeClient(ticketDetailResponse(supportTicketFixture({ requester_last_read_at: '2026-11-19T10:10:00+00:00' })));
    const ticket = await createSupportApiSource({ client, space: 'tenant' }).markRead(TICKET_ID);

    expect(client.patch).toHaveBeenCalledWith(`/api/v1/support/tickets/${TICKET_ID}`, { read: true });
    expect(ticket.requesterLastReadAt).toBe('2026-11-19T10:10:00+00:00');
  });

  it('télécharge une pièce par la route du demandeur et refuse un type inattendu', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response(new Blob(['x']), { status: 200, headers: { 'Content-Type': 'text/html' } })),
    );
    const source = createSupportApiSource({ client: fakeClient(), space: 'tenant', fetchImpl });

    await expect(source.downloadAttachment({ id: ATTACHMENT_ID, name: 'a.pdf' })).rejects.toBeInstanceOf(UnexpectedResponseError);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(`http://api.test/api/v1/support/attachments/${ATTACHMENT_ID}`);
  });

  it('refuse une réponse qui n’a pas la forme du serveur', async () => {
    const client = fakeClient({ data: [{ id: 1 }] });
    await expect(createSupportApiSource({ client, space: 'tenant' }).listTickets()).rejects.toBeInstanceOf(UnexpectedResponseError);
  });
});

describe('erreurs du support traduites en français', () => {
  it.each([
    [new ApiError(403, 'support_space_forbidden', 'brut'), 'forbidden', /n’a pas le profil de cet espace/],
    [new ApiError(404, 'ticket_not_found', 'brut'), 'notFound', /n’existe pas ou ne vous concerne pas/],
    [new ApiError(409, 'ticket_resolved', 'brut'), 'closed', /résolue depuis plus de 14 jours/],
    [new ApiError(409, 'idempotency_key_reused', 'brut'), 'conflict', /contenu différent/],
    [new ApiError(422, 'organization_not_member', 'brut'), 'invalid', /plus membre de cette organisation/],
    [new ApiError(401, 'unauthenticated', 'brut'), 'unauthenticated', /session a expiré/],
    [new ApiError(503, 'unavailable', 'brut'), 'unavailable', /momentanément indisponible/],
  ])('%s', (error, kind, message) => {
    const failure = describeSupportFailure(error);
    expect(failure.kind).toBe(kind);
    expect(failure.message).toMatch(message);
  });

  it('donne la limite d’ouverture sur un 429, et le délai ailleurs', () => {
    const throttled = new ApiError(429, 'too_many_requests', 'brut', {}, 90);
    expect(describeSupportFailure(throttled, 'open').message).toContain('5 par heure, 20 par jour');
    expect(describeSupportFailure(throttled).message).toContain('Patientez');
  });

  it('précise qu’un renvoi n’enregistre qu’une fois le message quand l’issue est incertaine', () => {
    expect(supportSendFailureMessage(new ApiError(503, 'unavailable', 'brut'))).toContain('qu’une seule fois');
    expect(supportSendFailureMessage(new ApiError(409, 'ticket_resolved', 'brut'))).not.toContain('qu’une seule fois');
  });
});
