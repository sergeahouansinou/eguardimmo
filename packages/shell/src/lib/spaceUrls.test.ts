import { afterEach, describe, expect, it, vi } from 'vitest';
import { authUrl, isExternalHref, spaceUrl } from './spaceUrls';

afterEach(() => {
  vi.unstubAllEnvs();
});

function production(env: Record<string, string> = {}) {
  vi.stubEnv('NODE_ENV', 'production');
  for (const name of [
    'NEXT_PUBLIC_AUTH_URL',
    'NEXT_PUBLIC_LOCATAIRE_URL',
    'NEXT_PUBLIC_PROPRIETAIRE_URL',
    'NEXT_PUBLIC_AGENCE_URL',
  ]) {
    vi.stubEnv(name, env[name] ?? '');
  }
}

describe('adresses inter-applications en développement', () => {
  it('utilise les ports locaux par défaut', () => {
    vi.stubEnv('NODE_ENV', 'development');
    for (const name of ['AUTH', 'LOCATAIRE', 'PROPRIETAIRE', 'AGENCE']) vi.stubEnv(`NEXT_PUBLIC_${name}_URL`, '');
    expect(authUrl('/profils')).toBe('http://localhost:3040/profils');
    expect(spaceUrl('locataire', '/')).toBe('http://localhost:3030/');
    expect(spaceUrl('proprietaire', '/aide')).toBe('http://localhost:3020/aide');
    expect(spaceUrl('agence', '/mandats')).toBe('http://localhost:3010/mandats');
  });

  it('la variable d’environnement l’emporte, sans barre finale', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('NEXT_PUBLIC_AUTH_URL', 'http://localhost:4040/');
    expect(authUrl('/compte/securite')).toBe('http://localhost:4040/compte/securite');
  });
});

describe('adresses inter-applications en production', () => {
  it('lit les variables et conserve la requête du chemin', () => {
    production({
      NEXT_PUBLIC_AUTH_URL: 'https://auth.eguardimmo.example',
      NEXT_PUBLIC_LOCATAIRE_URL: 'https://locataire.eguardimmo.example/',
    });
    expect(authUrl('/connexion?suite=%2Fprofils')).toBe('https://auth.eguardimmo.example/connexion?suite=%2Fprofils');
    expect(spaceUrl('locataire', '/loyers')).toBe('https://locataire.eguardimmo.example/loyers');
  });

  it('lève une erreur explicite si la variable manque, sans deviner une adresse', () => {
    production();
    expect(() => authUrl('/profils')).toThrow(/NEXT_PUBLIC_AUTH_URL n’est pas défini/);
    expect(() => spaceUrl('agence', '/')).toThrow(/NEXT_PUBLIC_AGENCE_URL n’est pas défini/);
  });

  it.each([
    ['pas une URL', 'auth.eguardimmo.example'],
    ['http hors hôte local', 'http://auth.eguardimmo.example'],
    ['identifiants', 'https://user:secret@auth.eguardimmo.example'],
    ['chemin', 'https://auth.eguardimmo.example/app'],
    ['schéma exotique', 'javascript://auth.eguardimmo.example'],
  ])('refuse une variable invalide (%s)', (_, value) => {
    production({ NEXT_PUBLIC_AUTH_URL: value });
    expect(() => authUrl('/profils')).toThrow(/NEXT_PUBLIC_AUTH_URL/);
  });

  it('admet http pour un hôte local', () => {
    production({ NEXT_PUBLIC_AUTH_URL: 'http://localhost:3040' });
    expect(authUrl('/profils')).toBe('http://localhost:3040/profils');
  });
});

describe('chemins', () => {
  it.each(['profils', '//evil.example', '/\\evil.example', 'https://evil.example/', '/a\nb', ''])(
    'refuse le chemin %j',
    (path) => {
      vi.stubEnv('NODE_ENV', 'development');
      expect(() => authUrl(path)).toThrow(/Chemin invalide/);
    },
  );
});

describe('isExternalHref', () => {
  it('distingue les adresses absolues des chemins internes', () => {
    expect(isExternalHref('https://auth.eguardimmo.example/profils')).toBe(true);
    expect(isExternalHref('http://localhost:3040/')).toBe(true);
    expect(isExternalHref('/notifications')).toBe(false);
    expect(isExternalHref('//evil.example')).toBe(false);
  });
});
