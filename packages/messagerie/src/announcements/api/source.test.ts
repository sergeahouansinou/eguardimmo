import { ApiError, buildUrl } from '@eguardimmo/api';
import type { ApiClient } from '@eguardimmo/api';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UnexpectedResponseError } from '../../external/api/errors';
import {
  ANNOUNCEMENT_ATTACHMENT_ID,
  ANNOUNCEMENT_ID,
  announcementFixture,
  announcementListResponse,
  announcementResponse,
  readAnnouncementFixture,
} from '../testing';
import { createAnnouncementsApiSource } from './source';

function fakeClient(reply: unknown = {}): ApiClient & Record<'get' | 'post', ReturnType<typeof vi.fn>> {
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

describe('source API des annonces', () => {
  it('liste les annonces du locataire avec le curseur et la taille de page', async () => {
    const client = fakeClient(announcementListResponse([announcementFixture()], { next_cursor: 'suite' }));
    const page = await createAnnouncementsApiSource({ client, space: 'tenant' }).list('curseur', 25);

    expect(client.get).toHaveBeenCalledWith('/api/v1/tenant/announcements', { per_page: 25, cursor: 'curseur' });
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).toBe('suite');
    expect(page.items[0]).toMatchObject({
      id: ANNOUNCEMENT_ID,
      organizationName: 'Agence des Tilleuls',
      subject: 'Coupure d’eau lundi',
      unread: true,
      readAt: null,
      attachments: [],
    });
  });

  it('interroge l’espace mandant pour un propriétaire', async () => {
    const client = fakeClient(announcementListResponse([]));
    await createAnnouncementsApiSource({ client, space: 'owner' }).list(null, 50);
    expect(client.get).toHaveBeenCalledWith('/api/v1/owner/announcements', { per_page: 50, cursor: null });
  });

  it('lit une annonce et traduit ses pièces jointes', async () => {
    const client = fakeClient(announcementResponse(announcementFixture({ attachments: [{ id: ANNOUNCEMENT_ATTACHMENT_ID, name: 'avis.pdf', size_bytes: 2048 }] })));
    const announcement = await createAnnouncementsApiSource({ client, space: 'tenant' }).get(ANNOUNCEMENT_ID);

    expect(client.get).toHaveBeenCalledWith(`/api/v1/tenant/announcements/${ANNOUNCEMENT_ID}`);
    expect(announcement.attachments).toEqual([{ id: ANNOUNCEMENT_ATTACHMENT_ID, name: 'avis.pdf', sizeBytes: 2048 }]);
  });

  it('marque une annonce lue par un POST sans corps utile', async () => {
    const client = fakeClient(announcementResponse(readAnnouncementFixture()));
    const announcement = await createAnnouncementsApiSource({ client, space: 'owner' }).markRead(ANNOUNCEMENT_ID);

    expect(client.post).toHaveBeenCalledWith(`/api/v1/owner/announcements/${ANNOUNCEMENT_ID}/read`, {});
    expect(announcement).toMatchObject({ unread: false, readAt: '2026-11-19T10:00:00+00:00' });
  });

  it('refuse une réponse qui ne respecte pas le contrat', async () => {
    const client = fakeClient({ data: { id: ANNOUNCEMENT_ID } });
    await expect(createAnnouncementsApiSource({ client, space: 'tenant' }).get(ANNOUNCEMENT_ID)).rejects.toBeInstanceOf(UnexpectedResponseError);
  });

  it('laisse remonter l’erreur serveur d’une annonce devenue invisible', async () => {
    const client = fakeClient();
    client.get.mockRejectedValue(new ApiError(404, 'announcement_not_found', 'Annonce introuvable'));
    await expect(createAnnouncementsApiSource({ client, space: 'tenant' }).get(ANNOUNCEMENT_ID)).rejects.toMatchObject({ status: 404, code: 'announcement_not_found' });
  });

  it('télécharge une pièce jointe en PDF depuis l’espace, sans la passer par une URL publique', async () => {
    const client = fakeClient();
    const fetchImpl = vi.fn(() => Promise.resolve(new Response(new Blob(['%PDF'], { type: 'application/pdf' }), { status: 200, headers: { 'Content-Type': 'application/pdf' } })));
    const created = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.spyOn(URL, 'revokeObjectURL').mockReturnValue();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    await createAnnouncementsApiSource({ client, space: 'tenant', fetchImpl }).downloadAttachment(ANNOUNCEMENT_ID, { id: ANNOUNCEMENT_ATTACHMENT_ID, name: 'avis.pdf' });

    expect(fetchImpl).toHaveBeenCalledWith(
      `http://api.test/api/v1/tenant/announcements/${ANNOUNCEMENT_ID}/attachments/${ANNOUNCEMENT_ATTACHMENT_ID}`,
      expect.objectContaining({ method: 'GET', credentials: 'include' }),
    );
    expect(created).toHaveBeenCalledTimes(1);
  });

  it('refuse un téléchargement dont le type n’est pas un PDF ou une image', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(new Response('<html>', { status: 200, headers: { 'Content-Type': 'text/html' } })));
    await expect(
      createAnnouncementsApiSource({ client: fakeClient(), space: 'tenant', fetchImpl }).downloadAttachment(ANNOUNCEMENT_ID, { id: ANNOUNCEMENT_ATTACHMENT_ID, name: 'x.pdf' }),
    ).rejects.toBeInstanceOf(UnexpectedResponseError);
  });
});
