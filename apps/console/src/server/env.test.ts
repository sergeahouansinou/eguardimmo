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

  it('exige https pour l’URL de l’API en production, localhost compris', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const base = { CONSOLE_SESSION_SECRET: KEY, CONSOLE_RELAY_KEY: RELAY, NODE_ENV: 'production', CONSOLE_PUBLIC_ORIGIN: 'https://console.example.com' };
    expect(parseServerEnv({ ...base, CONSOLE_API_URL: 'http://api.example.com' })).toBeNull();
    expect(parseServerEnv({ ...base, CONSOLE_API_URL: 'http://localhost:8000' })).toBeNull();
    expect(String(error.mock.calls[0]?.[0])).toContain('CONSOLE_API_URL');
    expect(parseServerEnv({ ...base, CONSOLE_API_URL: 'https://api.example.com/' })?.CONSOLE_API_URL).toBe('https://api.example.com');
  });

  it('permet http hors production', () => {
    const base = { CONSOLE_SESSION_SECRET: KEY, CONSOLE_RELAY_KEY: RELAY, CONSOLE_API_URL: 'http://localhost:8000' };
    expect(parseServerEnv({ ...base, NODE_ENV: 'development' })?.CONSOLE_API_URL).toBe('http://localhost:8000');
    expect(parseServerEnv({ ...base, NODE_ENV: 'test' })?.CONSOLE_API_URL).toBe('http://localhost:8000');
  });

  describe('origine publique de la console', () => {
    const base = { CONSOLE_API_URL: 'https://api.example.com', CONSOLE_SESSION_SECRET: KEY, CONSOLE_RELAY_KEY: RELAY };

    it('est obligatoire en production : sans elle la configuration est refusée', () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      expect(parseServerEnv({ ...base, NODE_ENV: 'production' })).toBeNull();
      expect(String(error.mock.calls[0]?.[0])).toContain('CONSOLE_PUBLIC_ORIGIN');
      expect(parseServerEnv({ ...base, NODE_ENV: 'production', CONSOLE_PUBLIC_ORIGIN: '' })).toBeNull();
    });

    it('doit utiliser https en production', () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      expect(parseServerEnv({ ...base, NODE_ENV: 'production', CONSOLE_PUBLIC_ORIGIN: 'http://console.example.com' })).toBeNull();
      expect(parseServerEnv({ ...base, NODE_ENV: 'production', CONSOLE_PUBLIC_ORIGIN: 'https://console.example.com/' })?.CONSOLE_PUBLIC_ORIGIN).toBe('https://console.example.com');
    });

    it('reste facultative hors production et se ramène à l’origine', () => {
      expect(parseServerEnv({ ...base, NODE_ENV: 'development' })?.CONSOLE_PUBLIC_ORIGIN).toBeUndefined();
      expect(parseServerEnv({ ...base, NODE_ENV: 'development', CONSOLE_PUBLIC_ORIGIN: 'http://localhost:3050/chemin?x=1' })?.CONSOLE_PUBLIC_ORIGIN).toBe('http://localhost:3050');
    });

    it('refuse un schéma autre que http(s)', () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      expect(parseServerEnv({ ...base, NODE_ENV: 'development', CONSOLE_PUBLIC_ORIGIN: 'ftp://console.example.com' })).toBeNull();
    });
  });
});
