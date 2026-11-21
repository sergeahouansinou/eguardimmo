import { describe, expect, it } from 'vitest';
import { internalHref } from './href';

describe('lien profond d’une notification', () => {
  it.each([
    '/finances/impayes',
    '/baux/01935a10-0000-7000-8000-000000000001',
    '/conformite/01935a60-0000-7000-8000-000000000001',
    '/loyers',
    '/finances/impayes?lease=12#haut',
  ])('suit le chemin interne %s', (href) => {
    expect(internalHref(href)).toBe(href);
  });

  it.each([
    null,
    '',
    'finances/impayes',
    'https://evil.example/finances',
    'http://evil.example',
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    ' javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    '//evil.example/finances',
    '/\\evil.example',
    '/\t/evil.example',
    '/\n/evil.example',
    '/a b',
    `/${'a'.repeat(2100)}`,
  ])('écarte %j', (href) => {
    expect(internalHref(href)).toBeNull();
  });
});
