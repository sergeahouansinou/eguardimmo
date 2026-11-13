import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { compile } from 'tailwindcss';
import { describe, expect, it } from 'vitest';

import { buildAll, GENERATED_DIR, staleFiles } from '../scripts/build.mjs';
import { TAILWIND_COLOR_NAMES, tailwindColors } from '../scripts/tailwind-names.mjs';
import { model } from './helpers';

const outputs = buildAll();

describe('sources', () => {
  it('les deux thèmes ont exactement les mêmes rôles', () => {
    const names = (theme: 'light' | 'dark'): string[] => model.roles[theme].map((r) => r.path.join('.')).sort();
    expect(names('dark')).toEqual(names('light'));
    expect(names('light').length).toBeGreaterThan(40);
  });
});

describe('tokens.css', () => {
  const css = outputs['tokens.css'] ?? '';

  it('pose le thème clair sur :root et le thème sombre aux deux endroits prévus', () => {
    expect(css).toContain(':root {\n  color-scheme: light;');
    expect(css).toContain('@media (prefers-color-scheme: dark) {\n  :root:not([data-theme="light"]) {');
    expect(css).toContain(':root[data-theme="dark"] {');
  });

  it('expose les rôles et les échelles, jamais la palette brute', () => {
    expect(css).toContain('--eg-bg-surface: #FFFFFF;');
    expect(css).toContain('--eg-nav-active-bg: rgb(198 236 79 / 0.14);');
    expect(css).toContain('--eg-text-page-title-line-height: 28px;');
    expect(css).toContain('--eg-space-40: 40px;');
    expect(css).toContain('--eg-radius-full: 999px;');
    expect(css).toContain('--eg-control-row: 36px;');
    expect(css).toContain('--eg-duration-fast: 120ms;');
    expect(css).toContain('--eg-focus-offset: 2px;');
    expect(css).not.toMatch(/palette|petrole|gris|shadow/);
  });

  it('préfixe toutes les variables par --eg-, sans --color-* ni variable nue', () => {
    const names = [...css.matchAll(/^\s+(--[\w-]+):/gm)].map((m) => m[1] ?? '');
    expect(names.length).toBeGreaterThan(100);
    expect(names.filter((name) => !name.startsWith('--eg-'))).toEqual([]);
  });

  it('définit le même ensemble de variables de couleur en clair et en sombre', () => {
    const roleVariables = new Set(model.roles.light.map((r) => `--eg-${r.path.join('-')}`));
    const names = (block: string): string[] =>
      [...block.matchAll(/--eg-[\w-]+(?=:)/g)].map((m) => m[0]).filter((name) => roleVariables.has(name));
    const [light = '', rest = ''] = css.split('@media');
    const [media = '', dataTheme = ''] = rest.split(':root[data-theme="dark"]');
    expect(names(media)).toEqual(names(light));
    expect(names(dataTheme)).toEqual(names(light));
  });
});

describe('theme.css (Tailwind 4)', () => {
  const css = outputs['theme.css'] ?? '';

  it('commence par la réinitialisation de la palette Tailwind', () => {
    const body = /@theme inline \{\n\s+([^\n]+)/.exec(css)?.[1];
    expect(body).toBe('--color-*: initial;');
  });

  it('est compilable par Tailwind : seuls nos rôles produisent des classes', async () => {
    const rule = async (candidate: string): Promise<string> =>
      (await compile(`${css}\n@tailwind utilities;`)).build([candidate]);
    expect(await rule('bg-surface')).toContain('background-color: var(--eg-bg-surface)');
    expect(await rule('text-fg')).toContain('color: var(--eg-text-default)');
    expect(await rule('border-line')).toContain('var(--eg-border-default)');
    expect(await rule('bg-action')).toContain('var(--eg-action-default)');
    expect(await rule('hover:bg-action-hover')).toContain('var(--eg-action-hover)');
    expect(await rule('text-on-action')).toContain('var(--eg-action-text)');
    expect(await rule('bg-danger-solid')).toContain('var(--eg-danger-default)');
    expect(await rule('outline-focus')).toContain('var(--eg-focus-ring)');
    expect(await rule('rounded-md')).toContain('var(--eg-radius-md)');
    expect(await rule('p-2.5')).toContain('calc(var(--eg-space-4) * 2.5)');
    expect(await rule('text-body')).toContain('var(--eg-text-body-line-height)');
    expect(await rule('font-sans')).toContain('var(--eg-font-sans)');
    expect(await rule('md:flex')).toContain('width >= 900px');
    expect(await rule('bg-red-500')).not.toContain('red');
    expect(await rule('bg-bg-surface')).not.toContain('background-color');
    expect(await rule('shadow-md')).not.toContain('shadow');
  });

  it("n'émet aucune variable circulaire ni aucune variable de thème sur :root", async () => {
    const compiler = await compile(`${css}\n@tailwind utilities;`);
    const built = compiler.build(['bg-surface', 'text-fg', 'rounded-md', 'p-2']);
    expect(built).not.toMatch(/:root|:host/);
    expect(css).not.toMatch(/--color-([\w-]+): var\(--color-\1\)/);
  });
});

describe('noms Tailwind des rôles', () => {
  it('chaque rôle a un nom et aucun nom ne sert deux fois', () => {
    const named = tailwindColors(model.roles.light);
    expect(named).toHaveLength(model.roles.light.length);
    const names = named.map((entry) => entry.tailwind);
    expect(new Set(names).size).toBe(names.length);
    expect(Object.keys(TAILWIND_COLOR_NAMES).sort()).toEqual(named.map((entry) => entry.role).sort());
  });

  it('échoue explicitement pour un rôle sans nom ou un nom en double', () => {
    const [first, second] = model.roles.light;
    if (first === undefined || second === undefined) throw new Error('rôles manquants');
    expect(() => tailwindColors([...model.roles.light, { path: ['bg', 'inconnu'], value: first.value }])).toThrow(
      /Rôles sans nom : \[bg\.inconnu\]/,
    );
    expect(() => tailwindColors(model.roles.light.slice(1))).toThrow(/noms pour un rôle inconnu : \[bg\.page\]/);
  });

  it('expose les noms courts dans theme.css', () => {
    const css = outputs['theme.css'] ?? '';
    expect(css).toContain('--color-surface: var(--eg-bg-surface);');
    expect(css).toContain('--color-fg-muted: var(--eg-text-muted);');
    expect(css).toContain('--color-danger-solid-hover: var(--eg-danger-hover);');
    expect(css).toContain('--spacing: var(--eg-space-4);');
    expect(css).not.toMatch(/--color-bg-|--color-text-/);
  });
});

describe('tokens.ts et tokens.dart', () => {
  it('tokens.ts porte les valeurs clair et sombre', () => {
    const ts = outputs['tokens.ts'] ?? '';
    expect(ts).toContain('bg: {\n        page: "#F6F8F8"');
    expect(ts).toContain('as const;');
    expect(ts).toContain('activeBg: "#C6EC4F24"');
  });

  it('tokens.dart déclare des constantes ARGB', () => {
    const dart = outputs['tokens.dart'] ?? '';
    expect(dart).toContain("import 'package:flutter/painting.dart';");
    expect(dart).toContain('static const Color lightBgPage = Color(0xFFF6F8F8);');
    expect(dart).toContain('static const Color lightNavActiveBg = Color(0x24C6EC4F);');
    expect(dart).toContain('static const double space10 = 10.0;');
    expect(dart).toContain('static const double radiusFull = 999.0;');
  });
});

describe('fichiers générés', () => {
  it('generated/ correspond aux sources', () => {
    expect(staleFiles(outputs)).toEqual([]);
    expect(readFileSync(join(GENERATED_DIR, 'tokens.css'), 'utf8')).toBe(outputs['tokens.css']);
  });
});
