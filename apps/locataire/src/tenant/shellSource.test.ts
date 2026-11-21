import { createApiClient } from '@eguardimmo/api';
import { shellSchema } from '@eguardimmo/shell';
import { describe, expect, it, vi } from 'vitest';
import { ME } from './responses.fixtures';
import { NOTIFICATIONS_UNAVAILABLE_MESSAGE, createApiShellSource, toShellData } from './shellSource';

describe('coquille du locataire en mode api', () => {
  it('construit l’identité depuis /me, sans organisation ni donnée de démonstration', async () => {
    const urls: string[] = [];
    const fetchImpl = vi.fn<typeof fetch>((input) => {
      urls.push(typeof input === 'string' ? input : '');
      return Promise.resolve(new Response(JSON.stringify(ME), { status: 200 }));
    });
    const source = createApiShellSource(createApiClient({ baseUrl: 'http://api.test', fetchImpl, readCookie: () => null }));

    const shell = shellSchema.parse(await source.shell());

    expect(urls.map((url) => new URL(url).pathname)).toEqual(['/api/v1/me']);
    expect(shell).toEqual({
      user: { firstName: 'Awa', fullName: 'Awa Koné', initials: 'AK', email: 'awa.kone@example.test' },
      workspace: { name: 'Espace locataire', role: 'locataire' },
      counts: {},
      notifications: [],
    });
  });

  it('garde une seule initiale pour un nom d’un mot', () => {
    expect(toShellData({ name: 'Awa', email: 'awa@example.test' }).user.initials).toBe('A');
  });

  it('refuse honnêtement de marquer des notifications lues', async () => {
    const source = createApiShellSource(createApiClient({ baseUrl: 'http://api.test', fetchImpl: vi.fn<typeof fetch>(), readCookie: () => null }));

    await expect(source.markAllNotificationsRead()).rejects.toThrow(NOTIFICATIONS_UNAVAILABLE_MESSAGE);
    expect(source.markNotificationRead).toBeUndefined();
  });

  it('propage une réponse /me inattendue', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() => Promise.resolve(new Response(JSON.stringify({ data: { name: '' } }), { status: 200 })));
    const source = createApiShellSource(createApiClient({ baseUrl: 'http://api.test', fetchImpl, readCookie: () => null }));

    await expect(source.shell()).rejects.toThrow('inattendu');
  });
});
