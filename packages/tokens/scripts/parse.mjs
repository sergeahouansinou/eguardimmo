import { isRecord } from './resolve.mjs';

/** @typedef {import('./types.d.ts').Json} Json */
/** @typedef {import('./types.d.ts').Rgba} Rgba */
/** @typedef {import('./types.d.ts').ScaleNode} ScaleNode */

const HEX = /^#([0-9a-fA-F]{6})$/;

/**
 * @param {Json} value
 * @param {string} key
 * @returns {Rgba}
 */
export function parseColor(value, key) {
  const hex = typeof value === 'string' ? value : isRecord(value) ? value['color'] : undefined;
  const alpha = isRecord(value) ? value['alpha'] : 1;
  const digits = typeof hex === 'string' ? HEX.exec(hex)?.[1] : undefined;
  if (digits === undefined || typeof alpha !== 'number' || alpha < 0 || alpha > 1) {
    throw new Error(`Valeur de couleur invalide pour ${key} : ${JSON.stringify(value)}`);
  }
  return {
    r: parseInt(digits.slice(0, 2), 16),
    g: parseInt(digits.slice(2, 4), 16),
    b: parseInt(digits.slice(4, 6), 16),
    a: alpha,
  };
}

/**
 * @param {Json} value
 * @param {string} unit
 * @param {string} key
 * @returns {number}
 */
function parseMeasure(value, unit, key) {
  const match = typeof value === 'string' ? /^(\d+(?:\.\d+)?)([a-z]+)$/.exec(value) : null;
  const amount = match?.[1];
  if (amount === undefined || match?.[2] !== unit) {
    throw new Error(`Valeur invalide pour ${key} : « ${JSON.stringify(value)} » (attendu : nombre + ${unit})`);
  }
  return Number(amount);
}

/**
 * @param {string | undefined} type
 * @param {Json} value
 * @param {string} key
 * @returns {ScaleNode}
 */
export function parseScale(type, value, key) {
  switch (type) {
    case 'dimension':
      return parseMeasure(value, 'px', key);
    case 'duration':
      return parseMeasure(value, 'ms', key);
    case 'number':
      if (typeof value !== 'number') throw new Error(`Nombre attendu pour ${key}`);
      return value;
    case 'fontFamily':
      if (typeof value !== 'string') throw new Error(`Chaîne attendue pour ${key}`);
      return value;
    case 'typography': {
      const style = isRecord(value) ? value : {};
      const weight = style['fontWeight'];
      if (typeof weight !== 'number') throw new Error(`fontWeight invalide pour ${key}`);
      return {
        fontSize: parseMeasure(style['fontSize'] ?? null, 'px', `${key}.fontSize`),
        lineHeight: parseMeasure(style['lineHeight'] ?? null, 'px', `${key}.lineHeight`),
        fontWeight: weight,
      };
    }
    default:
      throw new Error(`Type de jeton non géré pour ${key} : ${String(type)}`);
  }
}
