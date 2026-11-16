export function normalizedPath(pathname: string): string {
  const path = pathname.split(/[?#]/)[0] ?? '';
  return path.length > 1 ? path.replace(/\/+$/, '') : path || '/';
}

function matches(prefix: string, path: string): boolean {
  if (prefix === '/') return path === '/';
  return path === prefix || path.startsWith(`${prefix}/`);
}

export function matchRoute<Outcome extends string>(
  routes: readonly (readonly [prefix: string, outcome: Outcome])[],
  pathname: string,
): Outcome | null {
  const path = normalizedPath(pathname);
  let best: { length: number; outcome: Outcome } | null = null;
  for (const [prefix, outcome] of routes) {
    if (matches(prefix, path) && (best === null || prefix.length > best.length)) best = { length: prefix.length, outcome };
  }
  return best?.outcome ?? null;
}
