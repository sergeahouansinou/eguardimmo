import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parseColor, parseScale } from './parse.mjs';
import { collectTokens, mergeTokens, resolveToken } from './resolve.mjs';

/** @typedef {import('./types.d.ts').Model} Model */
/** @typedef {import('./types.d.ts').RoleColor} RoleColor */
/** @typedef {import('./types.d.ts').ScaleNode} ScaleNode */
/** @typedef {import('./types.d.ts').Source} Source */
/** @typedef {import('./types.d.ts').RawToken} RawToken */

/**
 * @param {string} srcDir
 * @returns {Source}
 */
export function readSource(srcDir) {
  /** @param {string} file @returns {import('./types.d.ts').Json} */
  const read = (file) => JSON.parse(readFileSync(join(srcDir, file), 'utf8'));
  return {
    palette: read('palette.json'),
    light: read('themes/light.json'),
    dark: read('themes/dark.json'),
    scale: read('scale.json'),
  };
}

/**
 * @param {Map<string, RawToken>} theme
 * @param {Map<string, RawToken>} palette
 * @returns {RoleColor[]}
 */
function resolveTheme(theme, palette) {
  const tokens = mergeTokens([palette, theme]);
  return [...theme.entries()].map(([key, token]) => {
    if (token.type !== 'color' || token.path[0] !== 'color') {
      throw new Error(`Le rôle ${key} doit être un jeton de type color sous « color ».`);
    }
    return { path: token.path.slice(1), value: parseColor(resolveToken(key, tokens), key) };
  });
}

/**
 * @param {Map<string, RawToken>} light
 * @param {Map<string, RawToken>} dark
 */
function assertSameRoles(light, dark) {
  const missingInDark = [...light.keys()].filter((key) => !dark.has(key));
  const missingInLight = [...dark.keys()].filter((key) => !light.has(key));
  if (missingInDark.length > 0 || missingInLight.length > 0) {
    throw new Error(
      `Les thèmes clair et sombre n'ont pas les mêmes rôles. Absents du sombre : [${missingInDark.join(', ')}] ; absents du clair : [${missingInLight.join(', ')}]`,
    );
  }
}

/**
 * @param {Source['scale']} scaleTree
 * @returns {Model['scale']}
 */
function resolveScale(scaleTree) {
  const tokens = collectTokens(scaleTree, 'scale.json');
  /** @type {{ [key: string]: ScaleNode }} */
  const scale = {};
  for (const [key, token] of tokens) {
    const value = parseScale(token.type, resolveToken(key, tokens), key);
    /** @type {{ [key: string]: ScaleNode }} */
    let cursor = scale;
    for (const segment of token.path.slice(0, -1)) {
      const next = cursor[segment];
      if (typeof next === 'object') {
        cursor = next;
      } else {
        /** @type {{ [key: string]: ScaleNode }} */
        const created = {};
        cursor[segment] = created;
        cursor = created;
      }
    }
    const last = token.path.at(-1);
    if (last !== undefined) cursor[last] = value;
  }
  return scale;
}

/**
 * @param {Source} source
 * @returns {Model}
 */
export function buildModel(source) {
  const palette = collectTokens(source.palette, 'palette.json');
  const light = collectTokens(source.light, 'themes/light.json');
  const dark = collectTokens(source.dark, 'themes/dark.json');
  assertSameRoles(light, dark);
  return {
    roles: { light: resolveTheme(light, palette), dark: resolveTheme(dark, palette) },
    scale: resolveScale(source.scale),
  };
}

/**
 * @param {string} srcDir
 * @returns {Model}
 */
export function loadModel(srcDir) {
  return buildModel(readSource(srcDir));
}
