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
    { key: 'Content-Security-Policy', value: policy },
  ];
}

export const securityHeaders = createSecurityHeaders("frame-ancestors 'none'");

/**
 * @param {string} policy
 * @returns {() => Promise<{ source: string; headers: { key: string; value: string }[] }[]>}
 */
export function securityHeadersWithPolicy(policy) {
  return () => Promise.resolve([{ source: '/:path*', headers: createSecurityHeaders(policy) }]);
}

/** @returns {Promise<{ source: string; headers: { key: string; value: string }[] }[]>} */
export function securityHeadersForAllRoutes() {
  return Promise.resolve([{ source: '/:path*', headers: securityHeaders }]);
}
