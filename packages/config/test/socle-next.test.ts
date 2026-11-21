import { afterEach, describe, expect, it, vi } from 'vitest';

import { createPublicEnvSchema, publicEnvSchema } from '../env/public';
import { appContentSecurityPolicy, contentSecurityPolicy, createSecurityHeaders, securityHeadersForApp, securityHeadersWithPolicy } from '../next/security-headers.js';

describe('publicEnvSchema', () => {
  it("accepte une URL d'API valide", () => {
    expect(publicEnvSchema.safeParse({ NEXT_PUBLIC_API_URL: 'https://api.example.com' }).success).toBe(true);
  });

  it('refuse une valeur absente ou invalide', () => {
    expect(publicEnvSchema.safeParse({}).success).toBe(false);
    expect(publicEnvSchema.safeParse({ NEXT_PUBLIC_API_URL: 'pas-une-url' }).success).toBe(false);
  });

  it('garde demo par défaut hors production', () => {
    for (const nodeEnv of [undefined, 'development', 'test']) {
      const parsed = createPublicEnvSchema(nodeEnv).parse({ NEXT_PUBLIC_API_URL: 'https://api.example.com' });
      expect(parsed.NEXT_PUBLIC_DATA_SOURCE).toBe('demo');
    }
  });

  it('refuse en production une source de données absente, avec un message clair', () => {
    const result = createPublicEnvSchema('production').safeParse({ NEXT_PUBLIC_API_URL: 'https://api.example.com' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['NEXT_PUBLIC_DATA_SOURCE']);
    expect(result.error?.issues[0]?.message).toContain('obligatoire en production');
  });

  it('accepte en production demo ou api posés explicitement', () => {
    for (const source of ['demo', 'api'] as const) {
      const parsed = createPublicEnvSchema('production').parse({ NEXT_PUBLIC_API_URL: 'https://api.example.com', NEXT_PUBLIC_DATA_SOURCE: source });
      expect(parsed.NEXT_PUBLIC_DATA_SOURCE).toBe(source);
    }
  });

  it('refuse une source inconnue quel que soit l’environnement', () => {
    for (const nodeEnv of ['production', 'development']) {
      const result = createPublicEnvSchema(nodeEnv).safeParse({ NEXT_PUBLIC_API_URL: 'https://api.example.com', NEXT_PUBLIC_DATA_SOURCE: 'mock' });
      expect(result.success).toBe(false);
    }
  });
});

describe('en-têtes de sécurité', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const byKey = (headers: { key: string; value: string }[]) => Object.fromEntries(headers.map(({ key, value }) => [key, value]));

  it('interdit le cadrage et le reniflage de type, isole la fenêtre', () => {
    const headers = byKey(createSecurityHeaders("frame-ancestors 'none'"));
    expect(headers['X-Frame-Options']).toBe('DENY');
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['Strict-Transport-Security']).toContain('max-age=63072000');
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['Permissions-Policy']).toBe('camera=(), microphone=(), geolocation=()');
    expect(headers['Cross-Origin-Opener-Policy']).toBe('same-origin');
  });

  it("s'applique à toutes les routes avec la politique de l'app", async () => {
    const [rule, ...others] = await securityHeadersForApp({ development: false, connectOrigins: ['https://api.exemple.test'] })();
    expect(others).toEqual([]);
    expect(rule?.source).toBe('/:path*');
    expect(byKey(rule?.headers ?? [])['Content-Security-Policy']).toBe(appContentSecurityPolicy({ connectOrigins: ['https://api.exemple.test'] }));
  });

  it('prend le mode développement dans NODE_ENV quand il n’est pas imposé', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const [dev] = await securityHeadersForApp()();
    expect(byKey(dev?.headers ?? [])['Content-Security-Policy']).toContain("'unsafe-eval'");
    vi.stubEnv('NODE_ENV', 'production');
    const [prod] = await securityHeadersForApp()();
    expect(byKey(prod?.headers ?? [])['Content-Security-Policy']).not.toContain("'unsafe-eval'");
  });
});

function directive(policy: string, name: string): string[] | undefined {
  const found = policy.split('; ').find((entry) => entry === name || entry.startsWith(`${name} `));
  return found === undefined ? undefined : found.slice(name.length).trim().split(' ').filter(Boolean);
}

describe('appContentSecurityPolicy', () => {
  const API = 'https://api.exemple.test';

  it('en production : script-src sans eval, fermée partout ailleurs, upgrade-insecure-requests', () => {
    const policy = appContentSecurityPolicy({ connectOrigins: [API] });
    expect(directive(policy, 'default-src')).toEqual(["'self'"]);
    expect(directive(policy, 'script-src')).toEqual(["'self'", "'unsafe-inline'"]);
    expect(directive(policy, 'style-src')).toEqual(["'self'", "'unsafe-inline'"]);
    expect(directive(policy, 'object-src')).toEqual(["'none'"]);
    expect(directive(policy, 'base-uri')).toEqual(["'self'"]);
    expect(directive(policy, 'form-action')).toEqual(["'self'"]);
    expect(directive(policy, 'frame-ancestors')).toEqual(["'none'"]);
    expect(directive(policy, 'font-src')).toEqual(["'self'"]);
    expect(directive(policy, 'img-src')).toEqual(["'self'", 'data:', 'blob:']);
    expect(directive(policy, 'frame-src')).toEqual(["'none'"]);
    expect(directive(policy, 'upgrade-insecure-requests')).toEqual([]);
    expect(policy).not.toContain('unsafe-eval');
    expect(policy).not.toMatch(/ws:|wss:/);
  });

  it("injecte l'origine de l'API (sans chemin) dans connect-src seulement", () => {
    const policy = appContentSecurityPolicy({ connectOrigins: [`${API}/api/v1/`, API, undefined, ' '] });
    expect(directive(policy, 'connect-src')).toEqual(["'self'", API]);
    expect(policy.split(API)).toHaveLength(2);
  });

  it("sans origine : connect-src reste sur 'self'", () => {
    expect(directive(appContentSecurityPolicy(), 'connect-src')).toEqual(["'self'"]);
  });

  it('refuse une origine invalide ou non http(s) plutôt que de la laisser passer', () => {
    for (const bad of ['pas-une-url', 'javascript:alert(1)', 'ftp://hote.test', '*']) {
      expect(() => appContentSecurityPolicy({ connectOrigins: [bad] })).toThrow(/Origine CSP invalide/);
    }
  });

  it('autorise un aperçu blob: en iframe uniquement quand l’app le demande', () => {
    expect(directive(appContentSecurityPolicy({ frameSources: ['blob:'] }), 'frame-src')).toEqual(['blob:']);
    expect(directive(appContentSecurityPolicy(), 'frame-src')).toEqual(["'none'"]);
  });

  it('en développement : eval et rechargement à chaud locaux, pas de upgrade-insecure-requests', () => {
    const policy = appContentSecurityPolicy({ development: true, connectOrigins: [API] });
    expect(directive(policy, 'script-src')).toEqual(["'self'", "'unsafe-inline'", "'unsafe-eval'"]);
    expect(directive(policy, 'connect-src')).toEqual(["'self'", API, 'ws://localhost:*', 'ws://127.0.0.1:*']);
    expect(directive(policy, 'upgrade-insecure-requests')).toBeUndefined();
    expect(directive(policy, 'object-src')).toEqual(["'none'"]);
  });

  it('ne code en dur aucun hôte : sans origine passée, aucune URL dans la politique de production', () => {
    expect(appContentSecurityPolicy()).not.toMatch(/https?:\/\//);
  });
});

describe('contentSecurityPolicy', () => {
  it('pose par défaut une politique fermée', () => {
    const directives = contentSecurityPolicy().split('; ');
    for (const expected of ["default-src 'self'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'", "object-src 'none'", "img-src 'self' data:", "connect-src 'self'", "script-src 'self'", "style-src 'self'"]) {
      expect(directives).toContain(expected);
    }
    expect(contentSecurityPolicy()).not.toContain('unsafe');
  });

  it('remplace ou ajoute une directive sans toucher aux autres', () => {
    const policy = contentSecurityPolicy({ 'script-src': ["'self'", "'unsafe-inline'"], 'worker-src': ["'self'"] });
    expect(policy).toContain("script-src 'self' 'unsafe-inline'");
    expect(policy).toContain("worker-src 'self'");
    expect(policy).toContain("object-src 'none'");
  });

  it('se glisse dans les en-têtes de toutes les routes', async () => {
    const policy = contentSecurityPolicy();
    const [rule] = await securityHeadersWithPolicy(policy)();
    expect(rule?.source).toBe('/:path*');
    expect(rule?.headers).toEqual(createSecurityHeaders(policy));
    expect(rule?.headers.find((header) => header.key === 'Content-Security-Policy')?.value).toBe(policy);
  });
});
