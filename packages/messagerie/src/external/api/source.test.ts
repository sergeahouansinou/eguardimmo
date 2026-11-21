import { ApiError, buildUrl } from '@eguardimmo/api';
import type { ApiClient } from '@eguardimmo/api';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ACCESS_ID,
  ATTACHMENT_ID,
  LEASE_ID,
  SECOND_MESSAGE_ID,
  THREAD_ID,
  detailResponse,
  listResponse,
  messageFixture,
  messagesResponse,
  ownMessageFixture,
  ownerOptionsResponse,
  tenantOptionsResponse,
  threadFixture,
  unreadResponse,
} from '../testing';
import { UnexpectedResponseError } from './errors';
import { createExternalApiSource } from './source';
import { safeFileName } from './transport';

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

const QUERY = { search: ' loyer ', archived: false, unread: false, scopeId: null, perPage: 25 };

afterEach(() => {
  vi.restoreAllMocks();
});

describe('source API des conversations externes', () => {
  it('liste les conversations du locataire avec la clé de bail et les booléens en 1', async () => {
    const client = fakeClient(listResponse([threadFixture()], { has_more: true, next_cursor: 'abc' }));
    const source = createExternalApiSource({ client, space: 'tenant' });

    const page = await source.listThreads({ ...QUERY, archived: true, unread: true, scopeId: LEASE_ID }, 'curseur');

    expect(client.get).toHaveBeenCalledWith('/api/v1/tenant/conversations', {
      per_page: 25,
      cursor: 'curseur',
      search: 'loyer',
      archived: 1,
      unread: 1,
      lease_id: LEASE_ID,
    });
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).toBe('abc');
    expect(page.items[0]).toMatchObject({ subject: 'Quittance de novembre', agencyName: 'Agence des Tilleuls', reference: { kind: 'lease', label: 'BAIL-2026-001' }, unread: true });
  });

  it('filtre le propriétaire par agence et lit une référence de mandat', async () => {
    const client = fakeClient(listResponse([threadFixture({ lease: null, mandate: { id: 'm1', reference: 'MAN-7' } })]));
    const source = createExternalApiSource({ client, space: 'owner' });

    const page = await source.listThreads({ ...QUERY, scopeId: 'agence-1' }, null);

    expect(client.get).toHaveBeenCalledWith('/api/v1/owner/conversations', expect.objectContaining({ agency: 'agence-1' }));
    expect(page.items[0]?.reference).toEqual({ kind: 'mandate', label: 'MAN-7' });
  });

  it('lit un fil avec ses messages et le curseur de l’historique', async () => {
    const client = fakeClient(detailResponse(threadFixture(), [messageFixture(), ownMessageFixture()], { has_more: true, next_cursor: 'older' }));
    const thread = await createExternalApiSource({ client, space: 'tenant' }).getThread(THREAD_ID);

    expect(client.get).toHaveBeenCalledWith(`/api/v1/tenant/conversations/${THREAD_ID}`);
    expect(thread.messages.map((message) => [message.side, message.mine])).toEqual([['agency', false], ['me', true]]);
    expect(thread.hasEarlier).toBe(true);
    expect(thread.earlierCursor).toBe('older');
  });

  it('interroge les nouveaux messages après un repère et lit les métadonnées', async () => {
    const client = fakeClient(messagesResponse([messageFixture()], { status: 'closed', can_reply: false, agency_last_read_at: '2026-11-19T10:00:00+00:00' }));
    const page = await createExternalApiSource({ client, space: 'tenant' }).listMessages(THREAD_ID, { after: SECOND_MESSAGE_ID });

    expect(client.get).toHaveBeenCalledWith(`/api/v1/tenant/conversations/${THREAD_ID}/messages`, { after: SECOND_MESSAGE_ID, cursor: undefined });
    expect(page).toMatchObject({ status: 'closed', canReply: false, agencyLastReadAt: '2026-11-19T10:00:00+00:00' });
  });

  it('lit le compteur de non-lus', async () => {
    const client = fakeClient(unreadResponse(4));
    expect(await createExternalApiSource({ client, space: 'owner' }).unreadCount()).toBe(4);
    expect(client.get).toHaveBeenCalledWith('/api/v1/owner/conversations/unread');
  });

  it('normalise les options du locataire (bail) et du propriétaire (accès)', async () => {
    const tenant = await createExternalApiSource({ client: fakeClient(tenantOptionsResponse), space: 'tenant' }).composeOptions();
    const owner = await createExternalApiSource({ client: fakeClient(ownerOptionsResponse), space: 'owner' }).composeOptions();

    expect(tenant).toEqual([expect.objectContaining({ id: LEASE_ID, label: 'Agence des Tilleuls · Bail BAIL-2026-001' })]);
    expect(owner).toEqual([expect.objectContaining({ id: ACCESS_ID, label: 'Cabinet Delmas · Indivision Roux' })]);
  });

  it('ouvre un fil locataire en JSON avec la clé de bail et le client_id, sans identifiant d’agence', async () => {
    const client = fakeClient(detailResponse(threadFixture()));
    await createExternalApiSource({ client, space: 'tenant' }).openThread({ optionId: LEASE_ID, subject: 'Objet', body: 'Texte', files: [], clientId: 'cid' });

    expect(client.post).toHaveBeenCalledWith('/api/v1/tenant/conversations', { lease_id: LEASE_ID, subject: 'Objet', body: 'Texte', client_id: 'cid' });
  });

  it('ouvre un fil propriétaire avec l’identifiant d’accès et envoie les pièces en multipart', async () => {
    const client = fakeClient(detailResponse(threadFixture()));
    const file = new File(['x'], 'devis.pdf', { type: 'application/pdf' });
    await createExternalApiSource({ client, space: 'owner' }).openThread({ optionId: ACCESS_ID, subject: 'Objet', body: 'Texte', files: [file], clientId: 'cid' });

    const [path, body] = client.post.mock.calls[0] as [string, FormData];
    expect(path).toBe('/api/v1/owner/conversations');
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('access_id')).toBe(ACCESS_ID);
    expect(body.get('client_id')).toBe('cid');
    expect(body.getAll('attachments[]')).toHaveLength(1);
  });

  it('poste un message avec son client_id, le marque lu ou archivé et le retire', async () => {
    const client = fakeClient({ data: ownMessageFixture() });
    const source = createExternalApiSource({ client, space: 'tenant' });

    const message = await source.postMessage(THREAD_ID, { body: 'Bonjour', files: [], clientId: 'cid-1' });
    expect(client.post).toHaveBeenCalledWith(`/api/v1/tenant/conversations/${THREAD_ID}/messages`, { body: 'Bonjour', client_id: 'cid-1' });
    expect(message.mine).toBe(true);

    await source.redactMessage(THREAD_ID, SECOND_MESSAGE_ID);
    expect(client.post).toHaveBeenLastCalledWith(`/api/v1/tenant/conversations/${THREAD_ID}/messages/${SECOND_MESSAGE_ID}/redaction`, {});

    client.patch.mockResolvedValueOnce(detailResponse(threadFixture()));
    await source.markThread(THREAD_ID, { archived: true });
    expect(client.patch).toHaveBeenCalledWith(`/api/v1/tenant/conversations/${THREAD_ID}`, { archived: true });
  });

  it('refuse une réponse qui ne respecte pas le contrat du serveur', async () => {
    const source = createExternalApiSource({ client: fakeClient({ data: [{ id: 'x' }], meta: {} }), space: 'tenant' });
    await expect(source.listThreads(QUERY, null)).rejects.toBeInstanceOf(UnexpectedResponseError);
  });

  it('laisse remonter l’erreur serveur sans la transformer', async () => {
    const client = fakeClient();
    client.get.mockRejectedValueOnce(new ApiError(404, 'conversation_not_found', 'x'));
    await expect(createExternalApiSource({ client, space: 'tenant' }).getThread(THREAD_ID)).rejects.toMatchObject({ code: 'conversation_not_found' });
  });

  describe('téléchargement d’une pièce', () => {
    it('lit la pièce avec les cookies et l’enregistre sous un nom nettoyé', async () => {
      const fetchImpl = vi.fn<typeof fetch>(() => Promise.resolve(new Response('%PDF', { status: 200, headers: { 'Content-Type': 'application/pdf' } })));
      URL.createObjectURL = vi.fn(() => 'blob:x');
      URL.revokeObjectURL = vi.fn();
      const names: string[] = [];
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
        names.push(this.download);
      });
      const source = createExternalApiSource({ client: fakeClient(), space: 'owner', fetchImpl });

      await source.downloadAttachment({ id: ATTACHMENT_ID, name: '../../etc/passwd<script>.pdf' });

      expect(fetchImpl).toHaveBeenCalledWith(`http://api.test/api/v1/owner/conversation-attachments/${ATTACHMENT_ID}`, expect.objectContaining({ credentials: 'include', method: 'GET' }));
      expect(names).toEqual(['etc passwd script .pdf']);
    });

    it('refuse un contenu qui n’est ni un PDF ni une image', async () => {
      const fetchImpl = vi.fn<typeof fetch>(() => Promise.resolve(new Response('<html>', { status: 200, headers: { 'Content-Type': 'text/html' } })));
      const source = createExternalApiSource({ client: fakeClient(), space: 'tenant', fetchImpl });
      await expect(source.downloadAttachment({ id: ATTACHMENT_ID, name: 'a.pdf' })).rejects.toBeInstanceOf(UnexpectedResponseError);
    });

    it('traduit un refus serveur en erreur d’API', async () => {
      const fetchImpl = vi.fn<typeof fetch>(() => Promise.resolve(new Response(JSON.stringify({ code: 'attachment_not_found' }), { status: 404, headers: { 'Content-Type': 'application/json' } })));
      const source = createExternalApiSource({ client: fakeClient(), space: 'tenant', fetchImpl });
      await expect(source.downloadAttachment({ id: ATTACHMENT_ID, name: 'a.pdf' })).rejects.toMatchObject({ status: 404, code: 'attachment_not_found' });
    });
  });
});

describe('nom de fichier', () => {
  it.each([
    ['facture.pdf', 'facture.pdf'],
    ['../../a/b.pdf', 'a b.pdf'],
    ['..\\..\\secret.png', 'secret.png'],
    ['   ', 'piece-jointe'],
    ['.htaccess', 'htaccess'],
    ['a\u0000b\nc.pdf', 'a b c.pdf'],
  ])('nettoie %j en %j', (input, expected) => {
    expect(safeFileName(input)).toBe(expected);
  });

  it('limite la longueur', () => {
    expect(safeFileName(`${'a'.repeat(300)}.pdf`).length).toBeLessThanOrEqual(120);
  });
});
