export function normalizedPath(pathname: string): string {
  const path = pathname.split(/[?#]/)[0] ?? '';
  return path.length > 1 ? path.replace(/\/+$/, '') : path || '/';
}

const WILDCARD = '*';

function segmentsOf(path: string): string[] {
  return path === '/' ? [] : path.slice(1).split('/');
}

function matches(prefix: string, path: string): boolean {
  if (prefix === '/') return path === '/';
  const wanted = segmentsOf(prefix);
  const actual = segmentsOf(path);
  return wanted.length <= actual.length && wanted.every((segment, index) => segment === WILDCARD || segment === actual[index]);
}

export function matchRoute<Outcome extends string>(
  routes: readonly (readonly [prefix: string, outcome: Outcome])[],
  pathname: string,
): Outcome | null {
  const path = normalizedPath(pathname);
  let best: { length: number; outcome: Outcome } | null = null;
  for (const [prefix, outcome] of routes) {
    const length = segmentsOf(prefix).length;
    if (matches(prefix, path) && (best === null || length > best.length)) best = { length, outcome };
  }
  return best?.outcome ?? null;
}
