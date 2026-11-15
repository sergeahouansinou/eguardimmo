import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseServerEnv } from './env';

const KEY = Buffer.alloc(32, 1).toString('base64');
const RELAY = 'cle-de-relais-de-test-de-32-caracteres';

describe('configuration serveur', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('accepte une configuration complète et applique la durée par défaut', () => {
    const env = parseServerEnv({ CONSOLE_API_URL: 'http://api:8000/', CONSOLE_SESSION_SECRET: KEY, CONSOLE_RELAY_KEY: RELAY });
    expect(env?.CONSOLE_API_URL).toBe('http://api:8000');
    expect(env?.CONSOLE_SESSION_SECRET.length).toBe(32);
    expect(env?.CONSOLE_TOKEN_TTL_MINUTES).toBe(240);
    expect(env?.CONSOLE_TRUSTED_PROXY_HOPS).toBe(1);
  });

  it('exige une clé de relais assez longue', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(parseServerEnv({ CONSOLE_API_URL: 'http://api:8000', CONSOLE_SESSION_SECRET: KEY })).toBeNull();
    expect(parseServerEnv({ CONSOLE_API_URL: 'http://api:8000', CONSOLE_SESSION_SECRET: KEY, CONSOLE_RELAY_KEY: 'courte' })).toBeNull();
  });

  it('refuse une clé qui ne fait pas 32 octets, sans en afficher la valeur', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const short = Buffer.alloc(16, 1).toString('base64');
    expect(parseServerEnv({ CONSOLE_API_URL: 'http://api:8000', CONSOLE_SESSION_SECRET: short, CONSOLE_RELAY_KEY: RELAY })).toBeNull();
    expect(parseServerEnv({ CONSOLE_API_URL: 'http://api:8000', CONSOLE_SESSION_SECRET: 'pas-du-base64!' })).toBeNull();
    expect(String(error.mock.calls[0]?.[0])).not.toContain(short);
  });

  it('refuse une configuration absente sans lever d’exception', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(parseServerEnv({})).toBeNull();
  });
});
