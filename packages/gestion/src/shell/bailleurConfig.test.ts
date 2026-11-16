import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('configuration de la coquille bailleur', () => {
  it('se charge sans adresse de l’application d’authentification, même en production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_AUTH_URL', '');

    const config = await import('./bailleurConfig');

    expect(config.bottomItems.length).toBeGreaterThan(0);
  });

  it('signale la variable manquante au moment de construire le menu du compte', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_AUTH_URL', '');
    const { accountMenu } = await import('./bailleurConfig');

    expect(() => accountMenu()).toThrow('NEXT_PUBLIC_AUTH_URL n’est pas défini');
  });

  it('garde les mêmes liens quand la variable est définie', async () => {
    vi.stubEnv('NEXT_PUBLIC_AUTH_URL', 'http://localhost:3040');
    const { accountMenu } = await import('./bailleurConfig');

    const menu = accountMenu();

    expect(menu.switchSpace?.href).toBe('http://localhost:3040/profils');
    expect(menu.signOut.href).toBe('http://localhost:3040/deconnecte');
  });
});
