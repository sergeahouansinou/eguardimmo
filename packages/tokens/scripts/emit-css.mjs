import { flattenScale, toCss } from './format.mjs';
import { tailwindColors } from './tailwind-names.mjs';

/** @typedef {import('./types.d.ts').Model} Model */
/** @typedef {import('./types.d.ts').RoleColor} RoleColor */

const HEADER = '/* Fichier généré par scripts/build.mjs : ne pas modifier à la main. */';
const SPACING_BASE_PX = 4;

/**
 * @param {string[]} path
 * @param {number | string} value
 * @returns {string[]}
 */
function scaleDeclarations(path, value) {
  const [root, ...rest] = path;
  switch (root) {
    case 'breakpoint':
      return [];
    case 'font':
      return [`--eg-font-${rest.slice(1).join('-')}: ${String(value)};`];
    case 'text': {
      const [name, property] = rest;
      if (name === undefined) return [];
      if (property === 'fontSize') return [`--eg-text-${name}: ${String(value)}px;`];
      if (property === 'lineHeight') return [`--eg-text-${name}-line-height: ${String(value)}px;`];
      return [`--eg-text-${name}-font-weight: ${String(value)};`];
    }
    case 'control':
      return [`--eg-control-${rest.slice(1).join('-')}: ${String(value)}px;`];
    case 'duration':
      return [`--eg-${path.join('-')}: ${String(value)}ms;`];
    case 'icon':
      if (rest[0] === 'stroke') return [`--eg-icon-stroke: ${String(value)};`];
      return [`--eg-${path.join('-')}: ${String(value)}px;`];
    default:
      return [`--eg-${path.join('-')}: ${String(value)}px;`];
  }
}

/**
 * @param {RoleColor[]} roles
 * @param {string} indent
 * @returns {string}
 */
function colorBlock(roles, indent) {
  return roles
    .map((role) => `${indent}--eg-${role.path.join('-')}: ${toCss(role.value)};`)
    .join('\n');
}

/**
 * @param {Model} model
 * @returns {string}
 */
export function emitTokensCss(model) {
  const scale = flattenScale(model.scale)
    .flatMap(({ path, value }) => scaleDeclarations(path, value))
    .map((line) => `  ${line}`)
    .join('\n');
  return `${HEADER}
:root {
  color-scheme: light;
${colorBlock(model.roles.light, '  ')}

${scale}
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
${colorBlock(model.roles.dark, '    ')}
  }
}

:root[data-theme="dark"] {
  color-scheme: dark;
${colorBlock(model.roles.dark, '  ')}
}
`;
}

/**
 * Bloc Tailwind 4 : `--ns-*: initial` retire l'espace de noms par défaut, puis chaque nom
 * court pointe vers la variable `--eg-*` de tokens.css (`inline` inscrit la référence dans les classes).
 * @param {Model} model
 * @returns {string}
 */
export function emitThemeCss(model) {
  const scale = flattenScale(model.scale);
  const under = (/** @type {string} */ root) => scale.filter(({ path }) => path[0] === root);
  const reference = (/** @type {string} */ name, /** @type {string} */ variable) =>
    `  --${name}: var(--eg-${variable});`;

  const colors = tailwindColors(model.roles.light).map(({ role, tailwind }) =>
    reference(`color-${tailwind}`, role.replaceAll('.', '-')),
  );
  const radii = under('radius').map(({ path }) => {
    const key = path.slice(1).join('-');
    return reference(`radius-${key}`, `radius-${key}`);
  });
  const textNames = [...new Set(under('text').map(({ path }) => path[1] ?? ''))];
  const texts = textNames.flatMap((name) => [
    reference(`text-${name}`, `text-${name}`),
    reference(`text-${name}--line-height`, `text-${name}-line-height`),
    reference(`text-${name}--font-weight`, `text-${name}-font-weight`),
  ]);
  const breakpoints = under('breakpoint').map(
    ({ path, value }) => `  --breakpoint-${path.slice(1).join('-')}: ${String(value)}px;`,
  );

  const lines = [
    '  --color-*: initial;',
    ...colors,
    '  --radius-*: initial;',
    ...radii,
    '  --font-*: initial;',
    reference('font-sans', 'font-sans'),
    '  --text-*: initial;',
    ...texts,
    '  --breakpoint-*: initial;',
    ...breakpoints,
    '  --shadow-*: initial;',
    '  --inset-shadow-*: initial;',
    '  --drop-shadow-*: initial;',
    reference('spacing', `space-${SPACING_BASE_PX}`),
  ];
  return `${HEADER}\n@theme inline {\n${lines.join('\n')}\n}\n`;
}
