import { describe, expect, it } from 'vitest';
import { readBoundedBody } from './body';
import { STREAMING, chunkedBody, endlessBody } from './testing/helpers';

const post = (body: BodyInit | null, headers: HeadersInit = {}) => new Request('http://localhost:3050/x', { method: 'POST', body, headers, ...STREAMING });

describe('readBoundedBody', () => {
  it('lit un corps complet en plusieurs morceaux', async () => {
    const body = await readBoundedBody(post(chunkedBody(['abc', 'def'])), 10);
    expect(new TextDecoder().decode(body ?? new Uint8Array())).toBe('abcdef');
  });

  it('renvoie un corps vide quand il n’y a pas de corps', async () => {
    expect((await readBoundedBody(new Request('http://localhost:3050/x'), 10))?.byteLength).toBe(0);
  });

  it('refuse un Content-Length déclaré au-delà du plafond sans lire le flux', async () => {
    const { body, pulled } = endlessBody(8);
    expect(await readBoundedBody(post(body, { 'Content-Length': '11' }), 10)).toBeNull();
    expect(pulled()).toBeLessThanOrEqual(1);
  });

  it('coupe un flux sans Content-Length dès que le plafond est dépassé', async () => {
    const { body, pulled } = endlessBody(8);
    expect(await readBoundedBody(post(body), 20)).toBeNull();
    expect(pulled()).toBeLessThanOrEqual(4);
  });

  it('accepte un corps de la taille exacte du plafond', async () => {
    expect((await readBoundedBody(post(chunkedBody(['12345', '67890'])), 10))?.byteLength).toBe(10);
  });
});
