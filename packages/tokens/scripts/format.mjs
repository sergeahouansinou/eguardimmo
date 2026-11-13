/** @typedef {import('./types.d.ts').Rgba} Rgba */
/** @typedef {import('./types.d.ts').ScaleNode} ScaleNode */

/**
 * @param {string} name
 * @returns {string}
 */
export function camelCase(name) {
  return name.replace(/-([a-z0-9])/g, (_match, letter) => String(letter).toUpperCase());
}

/**
 * @param {string} name
 * @returns {string}
 */
export function pascalCase(name) {
  const camel = camelCase(name);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

/**
 * @param {number} channel
 * @returns {string}
 */
function hexByte(channel) {
  return channel.toString(16).toUpperCase().padStart(2, '0');
}

/**
 * Hexadécimal #RRGGBB, ou #RRGGBBAA si la couleur est translucide.
 * @param {Rgba} color
 * @returns {string}
 */
export function toHex(color) {
  const base = `#${hexByte(color.r)}${hexByte(color.g)}${hexByte(color.b)}`;
  return color.a === 1 ? base : `${base}${hexByte(Math.round(color.a * 255))}`;
}

/**
 * @param {Rgba} color
 * @returns {string}
 */
export function toCss(color) {
  if (color.a === 1) return toHex(color);
  return `rgb(${color.r} ${color.g} ${color.b} / ${color.a})`;
}

/**
 * @param {Rgba} color
 * @returns {string}
 */
export function toDartColor(color) {
  return `Color(0x${hexByte(Math.round(color.a * 255))}${hexByte(color.r)}${hexByte(color.g)}${hexByte(color.b)})`;
}

/**
 * Liste à plat les feuilles de l'échelle : { path, value }.
 * @param {{ [key: string]: ScaleNode }} node
 * @param {string[]} [prefix]
 * @returns {{ path: string[]; value: number | string }[]}
 */
export function flattenScale(node, prefix = []) {
  return Object.entries(node).flatMap(([key, child]) =>
    typeof child === 'object'
      ? flattenScale(child, [...prefix, key])
      : [{ path: [...prefix, key], value: child }],
  );
}
