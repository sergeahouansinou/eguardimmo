import { ApiError, buildUrl } from '@eguardimmo/api';
import type { ApiClient } from '@eguardimmo/api';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UnexpectedResponseError } from '../../../external/api/errors';
import {
  ATTACHMENT_ID,
  GRANT_ID,
  ORGANIZATION_ID,
  OPERATOR_ID,
  OTHER_OPERATOR_ID,
  TICKET_ID,
  consoleDetailResponse,
  consoleGrantFixture,
  consoleGrantResponse,
  consoleListResponse,
  consoleMessagesResponse,
  consoleSettingsResponse,
  consoleStaffResponse,
  consoleStatsResponse,
  consoleTeamResponse,
  consoleTicketFixture,
  noteMessageFixture,
  replyMessageFixture,
  requesterMessageFixture,
} from '../testing';
import { EMPTY_QUERY } from '../model';
import { describeConsoleFailure, formatWait } from './errors';
import { createConsoleSupportApiSource } from './source';

function fakeClient(reply: unknown = {}): ApiClient & Record<'get' | 'post' | 'patch', ReturnType<typeof vi.fn>> {
  const respond = vi.fn(() => Promise.resolve(reply));
  return {
    baseUrl: 'http://console.test',
    get: respond,
    post: respond,
    put: respond,
    patch: respond,
    delete: respond,
    url: (path, query) => buildUrl('http://console.test', path, query),
  };
}

const source = (client: ApiClient, fetchImpl?: typeof fetch) =>
  createConsoleSupportApiSource({ client, operatorId: () => Promise.resolve(OPERATOR_ID), ...(fetchImpl ? { fetchImpl } : {}) });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('source API du support, côté équipe', () => {
  it('liste les demandes avec filtres, page, curseur de tri serveur et compteurs', async () => {
    const client = fakeClient(consoleListResponse([consoleTicketFixture({ first_response_overdue: true, assignee: { id: OTHER_OPERATOR_ID, name: 'Hugo Bernard' } })], { open: 3, waiting: 1, resolved: 2, all: 6 }, { total: 6, last_page: 2 }));
    const page = await source(client).listTickets(
      { ...EMPTY_QUERY, status: 'waiting', priority: 'high', assignee: 'me', space: 'organization', organization: ORGANIZATION_ID, search: '  quittance ', page: 2 },
      OPERATOR_ID,
    );
    expect(client.get).toHaveBeenCalledWith('/api/v1/console/support/tickets', {
      status: 'waiting',
      priority: 'high',
      assignee: OPERATOR_ID,
      space: 'organization',
      organization: ORGANIZATION_ID,
      search: 'quittance',
      page: 2,
      per_page: 20,
    });
    expect(page).toMatchObject({ page: 1, lastPage: 2, total: 6, counts: { open: 3, waiting: 1, resolved: 2, all: 6 } });
    expect(page.items[0]).toMatchObject({ firstResponseOverdue: true, organizationId: ORGANIZATION_ID, assignee: { id: OTHER_OPERATOR_ID } });
  });

  it('n’envoie aucun filtre pour « tous », et « sans assigné » reste « none »', async () => {
    const client = fakeClient(consoleListResponse([]));
    await source(client).listTickets({ ...EMPTY_QUERY, assignee: 'none' }, undefined);
    expect(client.get).toHaveBeenCalledWith('/api/v1/console/support/tickets', {
      status: undefined,
      priority: undefined,
      assignee: 'none',
      space: undefined,
      organization: undefined,
      search: undefined,
      page: 1,
      per_page: 20,
    });
  });

  it('lit les statistiques, dont le retard de première réponse', async () => {
    const client = fakeClient(consoleStatsResponse());
    expect(await source(client).stats()).toEqual({ open: 4, openHigh: 1, waiting: 1, resolved30d: 7, firstResponseMinutes: 135, firstResponseOverdue: 2 });
    expect(client.get).toHaveBeenCalledWith('/api/v1/console/support/stats');
  });

  it('lit le détail avec notes internes et accès, sans exposer d’identifiant de jeton', async () => {
    const client = fakeClient(consoleDetailResponse(consoleTicketFixture(), [requesterMessageFixture(), replyMessageFixture(), noteMessageFixture()], [consoleGrantFixture({ status: 'active', expires_at: '2026-11-20T10:00:00+00:00', read_count: 2 })]));
    const detail = await source(client).getTicket(TICKET_ID);
    expect(client.get).toHaveBeenCalledWith(`/api/v1/console/support/tickets/${TICKET_ID}`);
    expect(detail.messages.map((message) => [message.fromSupport, message.internal])).toEqual([[false, false], [true, false], [true, true]]);
    expect(detail.grants[0]).toMatchObject({ status: 'active', readCount: 2, operator: { id: OPERATOR_ID } });
  });

  it('lit les nouveaux messages après un repère, avec statut et accusés', async () => {
    const client = fakeClient(consoleMessagesResponse([noteMessageFixture()], { has_more: true, requester_last_read_at: '2026-11-19T10:30:00+00:00' }));
    const page = await source(client).listMessages(TICKET_ID, { after: 'abc' });
    expect(client.get).toHaveBeenCalledWith(`/api/v1/console/support/tickets/${TICKET_ID}/messages`, { after: 'abc' });
    expect(page).toMatchObject({ hasMore: true, requesterLastReadAt: '2026-11-19T10:30:00+00:00' });
    expect(page.items[0]?.internal).toBe(true);
  });

  it('modifie statut, priorité et assignation par PATCH, assignation retirée par null', async () => {
    const client = fakeClient(consoleDetailResponse(consoleTicketFixture()));
    await source(client).updateTicket(TICKET_ID, { status: 'resolved', priority: 'low', assigneeId: null });
    expect(client.patch).toHaveBeenCalledWith(`/api/v1/console/support/tickets/${TICKET_ID}`, { status: 'resolved', priority: 'low', assignee_id: null });
    await source(client).markRead(TICKET_ID);
    expect(client.patch).toHaveBeenLastCalledWith(`/api/v1/console/support/tickets/${TICKET_ID}`, { read: true });
  });

  it('poste une réponse puis une note interne avec client_id, en JSON sans pièce', async () => {
    const client = fakeClient(consoleDetailResponse(consoleTicketFixture()));
    await source(client).postMessage(TICKET_ID, { body: 'Bonjour', files: [], clientId: 'c-1', internal: false });
    expect(client.post).toHaveBeenLastCalledWith(`/api/v1/console/support/tickets/${TICKET_ID}/messages`, { body: 'Bonjour', client_id: 'c-1', internal: '0' });
    await source(client).postMessage(TICKET_ID, { body: 'Note', files: [], clientId: 'c-2', internal: true });
    expect(client.post).toHaveBeenLastCalledWith(`/api/v1/console/support/tickets/${TICKET_ID}/messages`, { body: 'Note', client_id: 'c-2', internal: '1' });
  });

  it('joint les pièces en formulaire', async () => {
    const client = fakeClient(consoleDetailResponse(consoleTicketFixture()));
    const file = new File([new Uint8Array(10)], 'capture.png', { type: 'image/png' });
    await source(client).postMessage(TICKET_ID, { body: 'Voir PJ', files: [file], clientId: 'c-3', internal: true });
    const [, body] = client.post.mock.calls[0] as [string, FormData];
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('internal')).toBe('1');
    expect(body.get('client_id')).toBe('c-3');
    expect(body.getAll('attachments[]')).toHaveLength(1);
  });

  it('demande un accès, ouvre une urgence et revoit une urgence par les routes de l’ADR', async () => {
    const client = fakeClient(consoleGrantResponse(consoleGrantFixture()));
    const grant = await source(client).requestAccess(TICKET_ID, { reason: 'Diagnostiquer l’erreur', scopes: ['team'], durationHours: 48 });
    expect(client.post).toHaveBeenLastCalledWith(`/api/v1/console/support/tickets/${TICKET_ID}/access-requests`, { reason: 'Diagnostiquer l’erreur', scopes: ['team'], duration_hours: 48 });
    expect(grant.status).toBe('requested');
    await source(client).openEmergency(TICKET_ID, { reason: 'Compte compromis', basis: 'security_incident' });
    expect(client.post).toHaveBeenLastCalledWith(`/api/v1/console/support/tickets/${TICKET_ID}/emergency-access`, { reason: 'Compte compromis', basis: 'security_incident' });
    await source(client).reviewGrant(GRANT_ID);
    expect(client.post).toHaveBeenLastCalledWith(`/api/v1/console/support/access/${GRANT_ID}/review`, {});
  });

  it('lit équipe et réglages d’une organisation par leurs routes gardées', async () => {
    const client = fakeClient(consoleTeamResponse);
    expect(await source(client).organizationTeam(ORGANIZATION_ID)).toEqual([
      { firstName: 'Awa', lastName: 'Koffi', role: 'owner' },
      { firstName: 'Paul', lastName: 'Diallo', role: 'manager' },
    ]);
    expect(client.get).toHaveBeenLastCalledWith(`/api/v1/console/organizations/${ORGANIZATION_ID}/team`);
    const settingsClient = fakeClient(consoleSettingsResponse);
    expect(await source(settingsClient).organizationSettings(ORGANIZATION_ID)).toEqual(consoleSettingsResponse.data);
    expect(settingsClient.get).toHaveBeenLastCalledWith(`/api/v1/console/organizations/${ORGANIZATION_ID}/settings`);
  });

  it('liste les opérateurs et résout l’opérateur courant', async () => {
    expect(await source(fakeClient(consoleStaffResponse)).staff()).toHaveLength(2);
    expect(await source(fakeClient()).operatorId()).toBe(OPERATOR_ID);
  });

  it('télécharge une pièce par la route console et refuse un type inattendu', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() => Promise.resolve(new Response(new Blob(['x']), { status: 200, headers: { 'Content-Type': 'text/html' } })));
    await expect(source(fakeClient(), fetchImpl).downloadAttachment({ id: ATTACHMENT_ID, name: 'a.pdf' })).rejects.toBeInstanceOf(UnexpectedResponseError);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(`http://console.test/api/v1/console/support/attachments/${ATTACHMENT_ID}`);
  });

  it('télécharge une pièce par la route console, avec les cookies et sans jeton, sous le nom validé', async () => {
    const created = vi.fn(() => 'blob:test');
    const revoked = vi.fn();
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: created, revokeObjectURL: revoked }));
    const clicked: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click(this: HTMLAnchorElement) {
      clicked.push(this.download);
    });
    const fetchImpl = vi.fn<typeof fetch>(() => Promise.resolve(new Response('%PDF', { status: 200, headers: { 'Content-Type': 'application/pdf' } })));
    await source(fakeClient(), fetchImpl).downloadAttachment({ id: ATTACHMENT_ID, name: 'quittance.pdf' });
    const [url, init] = fetchImpl.mock.calls[0] ?? ['', {}];
    expect(url).toBe(`http://console.test/api/v1/console/support/attachments/${ATTACHMENT_ID}`);
    expect(init).toMatchObject({ method: 'GET', credentials: 'include' });
    expect(new Headers(init?.headers).get('authorization')).toBeNull();
    expect(clicked).toEqual(['quittance.pdf']);
    expect(revoked).toHaveBeenCalledWith('blob:test');
    vi.unstubAllGlobals();
  });

  it('refuse une réponse qui n’a pas la forme du serveur', async () => {
    await expect(source(fakeClient({ data: [{ id: 1 }] })).listTickets(EMPTY_QUERY, undefined)).rejects.toBeInstanceOf(UnexpectedResponseError);
  });
});

describe('erreurs du support côté équipe, traduites en français', () => {
  it.each([
    [new ApiError(403, 'support_access_required', 'brut'), 'forbidden', /Accès requis/],
    [new ApiError(403, 'support_access_review_forbidden', 'brut'), 'forbidden', /autre opérateur/],
    [new ApiError(404, 'ticket_not_found', 'brut'), 'notFound', /n’existe pas/],
    [new ApiError(409, 'support_access_already_open', 'brut'), 'conflict', /déjà demandé ou ouvert/],
    [new ApiError(409, 'support_access_not_emergency', 'brut'), 'conflict', /Seul un accès d’urgence/],
    [new ApiError(409, 'support_emergency_review_pending', 'brut'), 'conflict', /doit l’être/],
    [new ApiError(409, 'support_emergency_organization_busy', 'brut'), 'conflict', /déjà ouvert sur cette organisation/],
    [new ApiError(409, 'idempotency_key_reused', 'brut'), 'conflict', /contenu différent/],
    [new ApiError(409, 'ticket_resolved', 'brut'), 'closed', /résolue/],
    [new ApiError(422, 'support_access_duration_invalid', 'brut'), 'invalid', /1 à 72 heures/],
    [new ApiError(422, 'support_access_organization_required', 'brut'), 'invalid', /aucune organisation/],
    [new ApiError(401, 'unauthenticated', 'brut'), 'unauthenticated', /session a expiré/],
    [new ApiError(503, 'unavailable', 'brut'), 'unavailable', /momentanément indisponible/],
  ])('%s', (error, kind, message) => {
    const failure = describeConsoleFailure(error);
    expect(failure.kind).toBe(kind);
    expect(failure.message).toMatch(message);
  });

  it('affiche le délai Retry-After des freins de l’accès d’urgence', () => {
    const cooldown = describeConsoleFailure(new ApiError(429, 'support_emergency_cooldown', 'brut', {}, 7200));
    expect(cooldown.kind).toBe('rateLimited');
    expect(cooldown.message).toContain('délai de suspension');
    expect(cooldown.message).toContain('2 h');
    expect(describeConsoleFailure(new ApiError(429, 'support_emergency_limit', 'brut', {}, 90)).message).toContain('2 min');
    expect(describeConsoleFailure(new ApiError(429, 'too_many_requests', 'brut', {}, 30)).message).toContain('Patientez 30 s');
  });

  it.each([
    [null, 'un instant'],
    [45, '45 s'],
    [600, '10 min'],
    [7200, '2 h'],
    [172_800, '2 jours'],
  ])('formate un délai de %s s', (seconds, label) => {
    expect(formatWait(seconds)).toBe(label);
  });
});
