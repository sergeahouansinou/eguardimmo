import { afterEach, describe, expect, it, vi } from 'vitest';

async function policyFor(nodeEnv: string): Promise<string> {
  vi.stubEnv('NODE_ENV', nodeEnv);
  vi.resetModules();
  const { default: config } = await import('../next.config');
  const rules = await config.headers?.();
  const header = rules?.[0]?.headers.find((entry) => entry.key === 'Content-Security-Policy');
  if (!header) throw new Error('CSP absente de next.config.ts.');
  return header.value;
}

function directive(policy: string, name: string): string[] {
  const found = policy.split('; ').find((entry) => entry.startsWith(`${name} `));
  return found ? found.slice(name.length + 1).split(' ') : [];
}

describe('CSP de la console', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('en production : fermée, sans unsafe-eval ni script distant, styles inline seulement', async () => {
    const policy = await policyFor('production');
    expect(directive(policy, 'default-src')).toEqual(["'self'"]);
    expect(directive(policy, 'base-uri')).toEqual(["'self'"]);
    expect(directive(policy, 'form-action')).toEqual(["'self'"]);
    expect(directive(policy, 'object-src')).toEqual(["'none'"]);
    expect(directive(policy, 'frame-ancestors')).toEqual(["'none'"]);
    expect(directive(policy, 'img-src')).toEqual(["'self'", 'data:']);
    expect(directive(policy, 'connect-src')).toEqual(["'self'"]);
    expect(directive(policy, 'script-src')).toEqual(["'self'", "'unsafe-inline'"]);
    expect(directive(policy, 'style-src')).toEqual(["'self'", "'unsafe-inline'"]);
    expect(policy).not.toContain('unsafe-eval');
    expect(policy).not.toMatch(/https?:|\*/);
  });

  it('en développement : autorise eval et les websockets du rechargement à chaud', async () => {
    const policy = await policyFor('development');
    expect(directive(policy, 'script-src')).toContain("'unsafe-eval'");
    expect(directive(policy, 'connect-src')).toEqual(["'self'", 'ws:', 'wss:']);
  });
});
