import { describe, expect, it } from 'vitest';

import { createPublicEnvSchema, publicEnvSchema } from '../env/public';
import { contentSecurityPolicy, createSecurityHeaders, securityHeaders, securityHeadersForAllRoutes, securityHeadersWithPolicy } from '../next/security-headers.js';

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

describe('securityHeaders', () => {
  it('interdit le cadrage et le reniflage de type', () => {
    const byKey = Object.fromEntries(securityHeaders.map(({ key, value }) => [key, value]));
    expect(byKey['X-Frame-Options']).toBe('DENY');
    expect(byKey['X-Content-Type-Options']).toBe('nosniff');
    expect(byKey['Content-Security-Policy']).toContain("frame-ancestors 'none'");
    expect(byKey['Strict-Transport-Security']).toContain('max-age=63072000');
  });

  it("s'applique à toutes les routes", async () => {
    await expect(securityHeadersForAllRoutes()).resolves.toEqual([
      { source: '/:path*', headers: securityHeaders },
    ]);
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
