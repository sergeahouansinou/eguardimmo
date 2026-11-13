const ALIAS = /^\{([^{}]+)\}$/;

/** @typedef {import('./types.d.ts').Json} Json */
/** @typedef {import('./types.d.ts').RawToken} RawToken */

/**
 * @param {Json} value
 * @returns {value is { [key: string]: Json }}
 */
export function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Aplatit un arbre DTCG en jetons ; `$type` d'un groupe est hérité par ses enfants.
 * @param {Json} tree
 * @param {string} origin
 * @returns {Map<string, RawToken>}
 */
export function collectTokens(tree, origin) {
  /** @type {Map<string, RawToken>} */
  const tokens = new Map();

  /**
   * @param {Json} node
   * @param {string[]} path
   * @param {string | undefined} inheritedType
   */
  const walk = (node, path, inheritedType) => {
    if (!isRecord(node)) {
      throw new Error(`${origin} : le noeud « ${path.join('.')} » n'est ni un groupe ni un jeton.`);
    }
    const declared = node['$type'];
    const type = typeof declared === 'string' ? declared : inheritedType;
    if ('$value' in node) {
      tokens.set(path.join('.'), { path, type, value: node['$value'] ?? null });
      return;
    }
    for (const [key, child] of Object.entries(node)) {
      if (!key.startsWith('$')) walk(child, [...path, key], type);
    }
  };

  walk(tree, [], undefined);
  return tokens;
}

/**
 * Fusionne plusieurs ensembles de jetons ; un même chemin dans deux fichiers est une erreur.
 * @param {Map<string, RawToken>[]} sets
 * @returns {Map<string, RawToken>}
 */
export function mergeTokens(sets) {
  /** @type {Map<string, RawToken>} */
  const merged = new Map();
  for (const set of sets) {
    for (const [key, token] of set) {
      if (merged.has(key)) throw new Error(`Jeton défini deux fois : ${key}`);
      merged.set(key, token);
    }
  }
  return merged;
}

/**
 * Résout récursivement les alias `{chemin.du.jeton}` d'une valeur de jeton.
 * @param {string} key
 * @param {Map<string, RawToken>} tokens
 * @param {string[]} [stack]
 * @returns {Json}
 */
export function resolveToken(key, tokens, stack = []) {
  const token = tokens.get(key);
  if (token === undefined) {
    const owner = stack.at(-1);
    throw new Error(
      `Alias introuvable : {${key}}${owner === undefined ? '' : ` (référencé par ${owner})`}`,
    );
  }
  if (stack.includes(key)) {
    throw new Error(`Alias cyclique : ${[...stack, key].join(' → ')}`);
  }
  return resolveValue(token.value, tokens, [...stack, key]);
}

/**
 * @param {Json} value
 * @param {Map<string, RawToken>} tokens
 * @param {string[]} stack
 * @returns {Json}
 */
function resolveValue(value, tokens, stack) {
  if (typeof value === 'string') {
    const match = ALIAS.exec(value);
    const target = match?.[1];
    return target === undefined ? value : resolveToken(target, tokens, stack);
  }
  if (Array.isArray(value)) return value.map((item) => resolveValue(item, tokens, stack));
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([name, item]) => [name, resolveValue(item, tokens, stack)]),
    );
  }
  return value;
}
