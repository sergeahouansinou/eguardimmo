/*
 * Choix (b) : script-src 'self' 'unsafe-inline' sans nonce. Un nonce impose le rendu dynamique de toutes
 * les pages : avec cacheComponents/PPR le HTML prérendu part sans nonce, tous les scripts sont bloqués
 * (essai en build de production : page non hydratée). Le reste est fermé : object-src, base-uri,
 * form-action, frame-ancestors, connect-src, img-src, frame-src. Origines autorisées : celles passées par app.
 */
/** @type {Record<string, string[]>} */
const STRICT_DIRECTIVES = {
  'default-src': ["'self'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'frame-ancestors': ["'none'"],
  'object-src': ["'none'"],
  'img-src': ["'self'", 'data:'],
  'font-src': ["'self'"],
  'connect-src': ["'self'"],
  'script-src': ["'self'"],
  'style-src': ["'self'"],
};

/**
 * @param {Record<string, string[]>} [overrides] directives remplacées ou ajoutées
 * @returns {string}
 */
export function contentSecurityPolicy(overrides = {}) {
  const directives = { ...STRICT_DIRECTIVES, ...overrides };
  return Object.entries(directives)
    .filter(([, sources]) => sources.length > 0)
    .map(([name, sources]) => `${name} ${sources.join(' ')}`)
    .join('; ');
}

/**
 * @param {string} policy
 * @returns {{ key: string; value: string }[]}
 */
export function createSecurityHeaders(policy) {
  return [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
    { key: 'Content-Security-Policy', value: policy },
  ];
}

/**
 * @param {string} value
 * @returns {string}
 */
function originOf(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Origine CSP invalide : ${JSON.stringify(value)}.`);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`Origine CSP invalide (http ou https attendu) : ${JSON.stringify(value)}.`);
  }
  return url.origin;
}

/**
 * @param {(string | undefined)[]} values
 * @returns {string[]}
 */
function origins(values) {
  const clean = values.filter((value) => value !== undefined && value.trim() !== '').map((value) => originOf(/** @type {string} */ (value).trim()));
  return [...new Set(clean)];
}

/**
 * @param {{
 *   development?: boolean,
 *   connectOrigins?: (string | undefined)[],
 *   frameSources?: string[],
 * }} [options] connectOrigins : API appelée depuis le navigateur ; frameSources : iframes (blob: pour un aperçu PDF)
 * @returns {string}
 */
export function appContentSecurityPolicy({ development = false, connectOrigins = [], frameSources = [] } = {}) {
  const policy = contentSecurityPolicy({
    'script-src': ["'self'", "'unsafe-inline'", ...(development ? ["'unsafe-eval'"] : [])],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:'],
    'connect-src': ["'self'", ...origins(connectOrigins), ...(development ? ['ws://localhost:*', 'ws://127.0.0.1:*'] : [])],
    'frame-src': frameSources.length > 0 ? frameSources : ["'none'"],
  });
  return development ? policy : `${policy}; upgrade-insecure-requests`;
}

/**
 * @param {Parameters<typeof appContentSecurityPolicy>[0]} [options] development vaut NODE_ENV === 'development' par défaut
 * @returns {() => Promise<{ source: string; headers: { key: string; value: string }[] }[]>}
 */
export function securityHeadersForApp(options = {}) {
  const development = options.development ?? process.env.NODE_ENV === 'development';
  return securityHeadersWithPolicy(appContentSecurityPolicy({ ...options, development }));
}

/**
 * @param {string} policy
 * @returns {() => Promise<{ source: string; headers: { key: string; value: string }[] }[]>}
 */
export function securityHeadersWithPolicy(policy) {
  return () => Promise.resolve([{ source: '/:path*', headers: createSecurityHeaders(policy) }]);
}
