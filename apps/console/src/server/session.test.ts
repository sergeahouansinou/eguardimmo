import { describe, expect, it } from 'vitest';
import { clearedSessionCookie, currentSession, openSession, readSealedCookie, sealSession, SESSION_COOKIE, sessionCookie } from './session';
import { KEY, call } from './testing/helpers';

const NOW = 1_800_000_000_000;
const SESSION = { token: '12|jeton-secret', expiresAt: NOW + 60_000 };

describe('session scellée', () => {
  it('relit ce qu’elle a scellé', () => {
    expect(openSession(sealSession(SESSION, KEY), KEY, NOW)).toEqual(SESSION);
  });

  it('ne laisse pas le jeton lisible dans le cookie', () => {
    const sealed = sealSession(SESSION, KEY);
    expect(sealed).not.toContain('jeton-secret');
    expect(Buffer.from(sealed, 'base64url').toString('utf8')).not.toContain('jeton-secret');
  });

  it('utilise un vecteur d’initialisation différent à chaque scellement', () => {
    expect(sealSession(SESSION, KEY)).not.toBe(sealSession(SESSION, KEY));
  });

  it('refuse un cookie altéré, quel que soit l’octet modifié', () => {
    const raw = Buffer.from(sealSession(SESSION, KEY), 'base64url');
    for (const index of [0, 12, 28, raw.length - 1]) {
      const copy = Buffer.from(raw);
      copy[index] = (copy[index] ?? 0) ^ 1;
      expect(openSession(copy.toString('base64url'), KEY, NOW)).toBeNull();
    }
  });

  it('refuse un cookie tronqué ou illisible', () => {
    const sealed = sealSession(SESSION, KEY);
    expect(openSession(sealed.slice(0, 20), KEY, NOW)).toBeNull();
    expect(openSession('', KEY, NOW)).toBeNull();
    expect(openSession('pas-un-cookie-scelle', KEY, NOW)).toBeNull();
  });

  it('refuse un cookie expiré', () => {
    const sealed = sealSession(SESSION, KEY);
    expect(openSession(sealed, KEY, SESSION.expiresAt)).toBeNull();
    expect(openSession(sealed, KEY, SESSION.expiresAt - 1)).toEqual(SESSION);
  });

  it('refuse un cookie scellé avec une autre clé', () => {
    expect(openSession(sealSession(SESSION, Buffer.alloc(32, 9)), KEY, NOW)).toBeNull();
  });

  it('extrait le cookie de session parmi d’autres cookies', () => {
    const sealed = sealSession(SESSION, KEY);
    const request = call('/x', { cookie: `autre=1; ${SESSION_COOKIE}=${sealed}; dernier=2` });
    expect(readSealedCookie(request)).toBe(sealed);
    expect(currentSession(request, KEY, NOW)).toEqual(SESSION);
    expect(currentSession(call('/x', { cookie: 'autre=1' }), KEY, NOW)).toBeNull();
  });

  it('pose un cookie __Host- HttpOnly, Secure, SameSite=Strict, sans Domain', () => {
    const cookie = sessionCookie('valeur', 14400);
    expect(cookie.startsWith('__Host-console_session=valeur;')).toBe(true);
    expect(cookie).toContain('Max-Age=14400');
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).not.toContain('Domain');
  });

  it('efface le cookie avec les mêmes attributs', () => {
    const cookie = clearedSessionCookie();
    expect(cookie).toContain('Max-Age=0');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('Path=/');
  });
});
