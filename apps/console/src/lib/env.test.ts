import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadEnv() {
  vi.resetModules();
  return import('./env');
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('variables publiques de la console', () => {
  it('prend la démonstration par défaut hors production, sans exiger d’URL d’API', async () => {
    vi.stubEnv('NEXT_PUBLIC_DATA_SOURCE', undefined);
    vi.stubEnv('NEXT_PUBLIC_API_URL', undefined);

    expect((await loadEnv()).dataSource).toBe('demo');
  });

  it('lit la source api sans variable publique d’API : le jeton reste côté serveur', async () => {
    vi.stubEnv('NEXT_PUBLIC_DATA_SOURCE', 'api');
    vi.stubEnv('NEXT_PUBLIC_API_URL', '');

    expect((await loadEnv()).dataSource).toBe('api');
  });

  it('refuse une source inconnue', async () => {
    vi.stubEnv('NEXT_PUBLIC_DATA_SOURCE', 'mock');

    await expect(loadEnv()).rejects.toThrow();
  });
});
