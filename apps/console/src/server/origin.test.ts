import { describe, expect, it } from 'vitest';
import { rejectForeignOrigin } from './origin';

const URL_BASE = 'http://localhost:3050/session';

function request(method: string, headers: Record<string, string> = {}): Request {
  return new Request(URL_BASE, { method, headers });
}

describe('rejectForeignOrigin', () => {
  it('exempte les méthodes sûres, avec ou sans Origin', () => {
    for (const method of ['GET', 'HEAD', 'OPTIONS']) {
      expect(rejectForeignOrigin(request(method), undefined)).toBeNull();
      expect(rejectForeignOrigin(request(method, { Origin: 'https://evil.example' }), undefined)).toBeNull();
    }
  });

  it('refuse une écriture sans Origin', async () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      const response = rejectForeignOrigin(request(method), undefined);
      expect(response?.status).toBe(403);
      expect(await response?.json()).toMatchObject({ code: 'forbidden_origin' });
    }
  });

  it('refuse une écriture venant d’un autre site, d’un autre port, d’un autre schéma ou d’une valeur illisible', () => {
    for (const origin of ['https://evil.example', 'http://localhost:3051', 'https://localhost:3050', 'http://localhost', 'null', 'pas une url']) {
      expect(rejectForeignOrigin(request('POST', { Origin: origin }), undefined)?.status).toBe(403);
    }
  });

  it('accepte une écriture dont l’Origin est celle de la console', () => {
    expect(rejectForeignOrigin(request('POST', { Origin: 'http://localhost:3050' }), undefined)).toBeNull();
    expect(rejectForeignOrigin(request('DELETE', { Origin: 'http://localhost:3050' }), undefined)).toBeNull();
  });

  it('suit l’hôte et le schéma transmis par le proxy', () => {
    const behindProxy = { 'X-Forwarded-Host': 'console.eguardimmo.fr', 'X-Forwarded-Proto': 'https' };
    expect(rejectForeignOrigin(request('POST', { ...behindProxy, Origin: 'https://console.eguardimmo.fr' }), undefined)).toBeNull();
    expect(rejectForeignOrigin(request('POST', { ...behindProxy, Origin: 'http://console.eguardimmo.fr' }), undefined)?.status).toBe(403);
    expect(rejectForeignOrigin(request('POST', { ...behindProxy, Origin: 'https://evil.example' }), undefined)?.status).toBe(403);
  });

  describe('avec CONSOLE_PUBLIC_ORIGIN', () => {
    const PUBLIC = 'https://console.eguardimmo.fr';

    it('compare l’Origin à la valeur configurée et ignore les en-têtes de redirection falsifiables', () => {
      const spoofed = { 'X-Forwarded-Host': 'evil.example', 'X-Forwarded-Proto': 'https', Host: 'evil.example' };
      expect(rejectForeignOrigin(request('POST', { ...spoofed, Origin: 'https://evil.example' }), PUBLIC)?.status).toBe(403);
      expect(rejectForeignOrigin(request('POST', { Origin: PUBLIC }), PUBLIC)).toBeNull();
    });

    it('refuse un autre schéma ou un autre port de la même machine', () => {
      for (const origin of ['http://console.eguardimmo.fr', 'https://console.eguardimmo.fr:8443', 'https://console.eguardimmo.fr.evil.example']) {
        expect(rejectForeignOrigin(request('POST', { Origin: origin }), PUBLIC)?.status).toBe(403);
      }
    });

    it('n’exige toujours rien des lectures', () => {
      expect(rejectForeignOrigin(request('GET'), PUBLIC)).toBeNull();
    });
  });
});
