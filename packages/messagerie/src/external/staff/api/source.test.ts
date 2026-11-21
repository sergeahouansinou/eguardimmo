import { ApiError, buildUrl } from '@eguardimmo/api';
import type { ApiClient } from '@eguardimmo/api';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UnexpectedResponseError } from '../../api/errors';
import {
  LEASE_ID,
  MANDATE_ID,
  OTHER_STAFF_ID,
  OWNER_PARTY_ID,
  SECOND_MESSAGE_ID,
  STAFF_ID,
  TENANT_ID,
  THREAD_ID,
  ownStaffMessageFixture,
  staffDetailResponse,
  staffIdentityResponse,
  staffListResponse,
  staffMessageFixture,
  staffMessagesResponse,
  staffRecipientsResponse,
  staffThreadFixture,
  staffUnreadResponse,
} from '../testing';
import { describeStaffFailure, staffSendFailureMessage } from './errors';
import { createStaffApiSource } from './source';

const ORG = 'org-1';
const ROOT = `/api/v1/org/${ORG}/conversations`;

function fakeClient(reply: unknown = {}): ApiClient & Record<'get' | 'post' | 'patch' | 'delete', ReturnType<typeof vi.fn>> {
  const respond = vi.fn((path?: string) => Promise.resolve(typeof reply === 'function' ? (reply as (path?: string) => unknown)(path) : reply));
  return { baseUrl: 'http://api.test', get: respond, post: respond, put: respond, patch: respond, delete: respond, url: (path, query) => buildUrl('http://api.test', path, query) };
}

const QUERY = { kind: 'tenant', tab: 'awaiting', search: ' loyer ', perPage: 25 } as const;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('source API des conversations externes côté agence', () => {
  it('liste une boîte par type, onglet et recherche, et lit les compteurs par onglet', async () => {
    const client = fakeClient(staffListResponse([staffThreadFixture()], { has_more: true, next_cursor: 'abc', counts: { all: 4, awaiting: 2, unread: 1, sent: 1, archived: 0 } }));
    const page = await createStaffApiSource({ client, organizationId: ORG, role: 'admin' }).listThreads(QUERY, 'curseur');

    expect(client.get).toHaveBeenCalledWith(ROOT, { kind: 'tenant', tab: 'awaiting', search: 'loyer', per_page: 25, cursor: 'curseur' });
    expect(page.counts).toEqual({ all: 4, awaiting: 2, unread: 1, sent: 1, archived: 0 });
    expect(page.nextCursor).toBe('abc');
    expect(page.items[0]).toMatchObject({ subject: 'Quittance de novembre', party: { name: 'Awa Koffi' }, lease: { reference: 'BAIL-2026-001' }, awaitingReply: true, lastAuthorSide: 'tenant' });
  });

  it('liste la boîte des mandants avec kind=owner', async () => {
    const client = fakeClient(staffListResponse([]));
    await createStaffApiSource({ client, organizationId: ORG, role: 'admin' }).listThreads({ ...QUERY, kind: 'owner', tab: 'all' }, null);
    expect(client.get).toHaveBeenCalledWith(ROOT, expect.objectContaining({ kind: 'owner', tab: 'all' }));
  });

  it('lit un fil, y compris l’accusé de lecture de la contrepartie et la restriction', async () => {
    const thread = staffThreadFixture({ counterpart_last_read_at: '2026-11-19T10:00:00+00:00', muted_until: '2026-12-01T00:00:00+00:00', muted_reason: 'Messages répétés' });
    const client = fakeClient(staffDetailResponse(thread, [staffMessageFixture(), ownStaffMessageFixture()], { has_more: true, next_cursor: 'older' }));
    const detail = await createStaffApiSource({ client, organizationId: ORG, role: 'admin' }).getThread(THREAD_ID);

    expect(client.get).toHaveBeenCalledWith(`${ROOT}/${THREAD_ID}`);
    expect(detail.messages.map((message) => [message.side, message.mine])).toEqual([['tenant', false], ['staff', true]]);
    expect(detail).toMatchObject({ counterpartLastReadAt: '2026-11-19T10:00:00+00:00', mutedReason: 'Messages répétés', hasEarlier: true, earlierCursor: 'older' });
  });

  it('interroge les nouveaux messages après un repère', async () => {
    const client = fakeClient(staffMessagesResponse([staffMessageFixture()], { status: 'closed', counterpart_last_read_at: '2026-11-19T10:00:00+00:00' }));
    const page = await createStaffApiSource({ client, organizationId: ORG, role: 'admin' }).listMessages(THREAD_ID, { after: SECOND_MESSAGE_ID });

    expect(client.get).toHaveBeenCalledWith(`${ROOT}/${THREAD_ID}/messages`, { after: SECOND_MESSAGE_ID, cursor: undefined });
    expect(page).toMatchObject({ status: 'closed', counterpartLastReadAt: '2026-11-19T10:00:00+00:00' });
  });

  it('lit les trois compteurs de non-lus', async () => {
    const client = fakeClient(staffUnreadResponse({ internal: 1, tenant: 2, owner: 3 }));
    expect(await createStaffApiSource({ client, organizationId: ORG, role: 'admin' }).unread()).toEqual({ internal: 1, tenant: 2, owner: 3 });
    expect(client.get).toHaveBeenCalledWith(`${ROOT}/unread`);
  });

  it('ouvre un fil locataire avec party_id, lease_id et client_id, sans mandate_id', async () => {
    const client = fakeClient(staffDetailResponse(staffThreadFixture()));
    await createStaffApiSource({ client, organizationId: ORG, role: 'manager' }).openThread({ kind: 'tenant', partyId: TENANT_ID, leaseId: LEASE_ID, mandateId: null, subject: 'Objet', body: 'Texte', files: [], clientId: 'cid' });

    expect(client.post).toHaveBeenCalledWith(ROOT, { kind: 'tenant', party_id: TENANT_ID, lease_id: LEASE_ID, subject: 'Objet', body: 'Texte', client_id: 'cid' });
  });

  it('ouvre un fil mandant avec mandate_id, ou sans mandat précis', async () => {
    const client = fakeClient(staffDetailResponse(staffThreadFixture({ kind: 'owner', party: { id: OWNER_PARTY_ID, name: 'Indivision Roux' }, lease: null, mandate: { id: MANDATE_ID, reference: 'MAN-7' } })));
    const source = createStaffApiSource({ client, organizationId: ORG, role: 'admin' });
    const base = { kind: 'owner', partyId: OWNER_PARTY_ID, leaseId: null, subject: 'S', body: 'B', files: [] as File[], clientId: 'c' } as const;

    await source.openThread({ ...base, mandateId: MANDATE_ID });
    expect(client.post).toHaveBeenLastCalledWith(ROOT, { kind: 'owner', party_id: OWNER_PARTY_ID, mandate_id: MANDATE_ID, subject: 'S', body: 'B', client_id: 'c' });
    await source.openThread({ ...base, mandateId: null });
    expect(client.post).toHaveBeenLastCalledWith(ROOT, { kind: 'owner', party_id: OWNER_PARTY_ID, subject: 'S', body: 'B', client_id: 'c' });
  });

  it('poste un message avec son client_id et envoie les pièces en multipart', async () => {
    const client = fakeClient({ data: ownStaffMessageFixture() });
    const source = createStaffApiSource({ client, organizationId: ORG, role: 'admin' });

    const message = await source.postMessage(THREAD_ID, { body: 'Bonjour', files: [], clientId: 'cid-1' });
    expect(client.post).toHaveBeenCalledWith(`${ROOT}/${THREAD_ID}/messages`, { body: 'Bonjour', client_id: 'cid-1' });
    expect(message.mine).toBe(true);

    await source.postMessage(THREAD_ID, { body: 'Avec pièce', files: [new File(['x'], 'devis.pdf', { type: 'application/pdf' })], clientId: 'cid-2' });
    const [, body] = client.post.mock.calls[1] as [string, FormData];
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('client_id')).toBe('cid-2');
    expect(body.getAll('attachments[]')).toHaveLength(1);
  });

  it('marque lu, archive, ferme et assigne par PATCH avec les seuls champs fournis', async () => {
    const client = fakeClient(staffDetailResponse(staffThreadFixture()));
    const source = createStaffApiSource({ client, organizationId: ORG, role: 'admin' });

    await source.markThread(THREAD_ID, { read: true });
    expect(client.patch).toHaveBeenLastCalledWith(`${ROOT}/${THREAD_ID}`, { read: true });
    await source.markThread(THREAD_ID, { archived: false });
    expect(client.patch).toHaveBeenLastCalledWith(`${ROOT}/${THREAD_ID}`, { archived: false });
    await source.updateThread(THREAD_ID, { status: 'closed' });
    expect(client.patch).toHaveBeenLastCalledWith(`${ROOT}/${THREAD_ID}`, { status: 'closed' });
    await source.updateThread(THREAD_ID, { assigneeId: null });
    expect(client.patch).toHaveBeenLastCalledWith(`${ROOT}/${THREAD_ID}`, { assignee_id: null });
  });

  it('retire un message avec ou sans motif, et restreint puis lève la restriction', async () => {
    const client = fakeClient({ data: staffMessageFixture({ redacted: true, body: '', redaction_reason: 'Erreur' }) });
    const source = createStaffApiSource({ client, organizationId: ORG, role: 'admin' });

    const redacted = await source.redactMessage(THREAD_ID, SECOND_MESSAGE_ID, 'Erreur');
    expect(client.post).toHaveBeenLastCalledWith(`${ROOT}/${THREAD_ID}/messages/${SECOND_MESSAGE_ID}/redaction`, { reason: 'Erreur' });
    expect(redacted).toMatchObject({ redacted: true, redactionReason: 'Erreur' });
    await source.redactMessage(THREAD_ID, SECOND_MESSAGE_ID, null);
    expect(client.post).toHaveBeenLastCalledWith(`${ROOT}/${THREAD_ID}/messages/${SECOND_MESSAGE_ID}/redaction`, {});

    client.post.mockResolvedValueOnce(staffDetailResponse(staffThreadFixture({ muted_until: '2026-12-01T00:00:00+00:00' })));
    const muted = await source.restrict(THREAD_ID, { days: 7, reason: 'Messages répétés' });
    expect(client.post).toHaveBeenLastCalledWith(`${ROOT}/${THREAD_ID}/mute`, { days: 7, reason: 'Messages répétés' });
    expect(muted.mutedUntil).toBe('2026-12-01T00:00:00+00:00');
    client.delete.mockResolvedValueOnce(staffDetailResponse(staffThreadFixture()));
    expect((await source.lift(THREAD_ID)).mutedUntil).toBeNull();
    expect(client.delete).toHaveBeenCalledWith(`${ROOT}/${THREAD_ID}/mute`);
  });

  it('assignation : écarte les comptables, ajoute l’utilisateur courant et trie par nom', async () => {
    const client = fakeClient((path?: string) => (path === '/api/v1/me' ? staffIdentityResponse : staffRecipientsResponse));
    const assignees = await createStaffApiSource({ client, organizationId: ORG, role: 'admin' }).assignees();

    expect(assignees).toEqual([
      { id: STAFF_ID, name: 'Camille Martin', role: 'admin' },
      { id: OTHER_STAFF_ID, name: 'Zoé Adjovi', role: 'manager' },
    ]);
  });

  it('refuse une réponse hors contrat plutôt que d’afficher des données incomplètes', async () => {
    const client = fakeClient({ data: [{ id: 'x' }], meta: {} });
    await expect(createStaffApiSource({ client, organizationId: ORG, role: 'admin' }).listThreads(QUERY, null)).rejects.toBeInstanceOf(UnexpectedResponseError);
  });

  it('n’emploie jamais le contenu d’un message dans l’URL', async () => {
    const client = fakeClient(staffListResponse([]));
    await createStaffApiSource({ client, organizationId: ORG, role: 'admin' }).listThreads({ ...QUERY, search: '' }, null);
    const [path] = client.get.mock.calls[0] as [string];
    expect(path).toBe(ROOT);
  });
});

describe('traduction des erreurs côté agence', () => {
  const failure = (status: number, code: string, fields: Record<string, string[]> = {}) => describeStaffFailure(new ApiError(status, code, 'brut', fields));

  it.each([
    [403, 'role_forbidden', 'forbidden', /Votre rôle ne permet pas/],
    [403, 'message_redaction_forbidden', 'forbidden', /dans les 15 minutes/],
    [403, 'two_factor_required', 'forbidden', /double authentification/],
    [403, 'reauthentication_required', 'forbidden', /moins de 10 minutes/],
    [404, 'conversation_not_found', 'notFound', /n’existe pas/],
    [404, 'conversation_link_not_found', 'notFound', /bail ou ce mandat/],
    [409, 'conversation_open_limit', 'conflict', /10 conversations ouvertes/],
    [409, 'idempotency_key_reused', 'conflict', /contenu différent/],
    [422, 'recipient_not_found', 'invalid', /pas de compte rattaché/],
    [422, 'assignee_invalid', 'invalid', /membre actif/],
  ] as const)('%i %s', (status, code, kind, message) => {
    const result = failure(status, code);
    expect(result.kind).toBe(kind);
    expect(result.message).toMatch(message);
  });

  it('traduit les champs invalides du motif et de la durée', () => {
    expect(failure(422, 'validation_failed', { reason: ['requis'] }).message).toMatch(/motif est obligatoire/);
    expect(failure(422, 'validation_failed', { days: ['max'] }).message).toMatch(/1 à 30 jours/);
  });

  it('retombe sur les messages communs pour 429 et 503 et rassure sur le renvoi après une panne', () => {
    expect(failure(429, 'too_many_requests').kind).not.toBe('unexpected');
    expect(staffSendFailureMessage(new ApiError(503, 'unavailable', 'brut'))).toMatch(/une seule fois/);
    expect(staffSendFailureMessage(new ApiError(409, 'conversation_open_limit', 'brut'))).not.toMatch(/une seule fois/);
  });
});
