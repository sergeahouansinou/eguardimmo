import { camelCase, flattenScale, pascalCase, toDartColor } from './format.mjs';

/** @typedef {import('./types.d.ts').Model} Model */

/**
 * @param {number} value
 * @returns {string}
 */
function dartDouble(value) {
  return Number.isInteger(value) ? `${value}.0` : String(value);
}

/**
 * @param {string[]} path
 * @returns {string}
 */
function memberName(path) {
  const [first = '', ...rest] = path;
  return camelCase(first) + rest.map(pascalCase).join('');
}

/**
 * @param {string[]} path
 * @param {number | string} value
 * @returns {string}
 */
function scaleMember(path, value) {
  const name = memberName(path);
  const root = path[0];
  if (typeof value === 'string') {
    const family = value.split(',')[0]?.trim() ?? value;
    return `  static const String ${name} = '${family}';`;
  }
  if (root === 'duration') {
    return `  static const Duration ${name} = Duration(milliseconds: ${value});`;
  }
  if (path.at(-1) === 'fontWeight') {
    return `  static const FontWeight ${name} = FontWeight.w${value};`;
  }
  return `  static const double ${name} = ${dartDouble(value)};`;
}

/**
 * @param {Model} model
 * @returns {string}
 */
export function emitTokensDart(model) {
  const colors = (/** @type {'light' | 'dark'} */ theme) =>
    model.roles[theme].map(
      (role) => `  static const Color ${memberName([theme, ...role.path])} = ${toDartColor(role.value)};`,
    );
  const scale = flattenScale(model.scale).map(({ path, value }) => scaleMember(path, value));
  return `// Fichier généré par scripts/build.mjs : ne pas modifier à la main.
import 'package:flutter/painting.dart';

abstract final class EgTokens {
${[...colors('light'), '', ...colors('dark'), '', ...scale].join('\n')}
}
`;
}
