import { camelCase, flattenScale, toHex } from './format.mjs';

/** @typedef {import('./types.d.ts').Model} Model */
/** @typedef {import('./types.d.ts').RoleColor} RoleColor */

/** @typedef {{ [key: string]: string | number | Tree }} Tree */

/**
 * @param {Tree} tree
 * @param {string[]} path
 * @param {string | number} value
 */
function insert(tree, path, value) {
  /** @type {Tree} */
  let cursor = tree;
  for (const segment of path.slice(0, -1)) {
    const key = camelCase(segment);
    const next = cursor[key];
    if (typeof next === 'object') {
      cursor = next;
    } else {
      /** @type {Tree} */
      const created = {};
      cursor[key] = created;
      cursor = created;
    }
  }
  const last = path.at(-1);
  if (last !== undefined) cursor[camelCase(last)] = value;
}

/**
 * @param {Tree} tree
 * @param {number} depth
 * @returns {string}
 */
function render(tree, depth) {
  const pad = '  '.repeat(depth);
  const lines = Object.entries(tree).map(([key, value]) => {
    const rendered = typeof value === 'object' ? render(value, depth + 1) : JSON.stringify(value);
    return `${pad}  ${key}: ${rendered},`;
  });
  return `{\n${lines.join('\n')}\n${pad}}`;
}

/**
 * @param {RoleColor[]} roles
 * @returns {Tree}
 */
function colorTree(roles) {
  /** @type {Tree} */
  const tree = {};
  for (const role of roles) insert(tree, role.path, toHex(role.value));
  return tree;
}

/**
 * @param {Model} model
 * @returns {string}
 */
export function emitTokensTs(model) {
  /** @type {Tree} */
  const scale = {};
  for (const { path, value } of flattenScale(model.scale)) insert(scale, path, value);
  const body = {
    color: { light: colorTree(model.roles.light), dark: colorTree(model.roles.dark) },
    ...scale,
  };
  return `// Fichier généré par scripts/build.mjs : ne pas modifier à la main.
export const tokens = ${render(body, 0)} as const;

export type Tokens = typeof tokens;
export type Theme = keyof Tokens['color'];
export type ThemeColors = Tokens['color'][Theme];
`;
}
