import { describe, expect, it } from 'vitest';

import { publicEnvSchema } from '../env/public';
import { securityHeaders, securityHeadersForAllRoutes } from '../next/security-headers.js';

describe('publicEnvSchema', () => {
  it("accepte une URL d'API valide", () => {
    expect(publicEnvSchema.safeParse({ NEXT_PUBLIC_API_URL: 'https://api.example.com' }).success).toBe(true);
  });

  it('refuse une valeur absente ou invalide', () => {
    expect(publicEnvSchema.safeParse({}).success).toBe(false);
    expect(publicEnvSchema.safeParse({ NEXT_PUBLIC_API_URL: 'pas-une-url' }).success).toBe(false);
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
