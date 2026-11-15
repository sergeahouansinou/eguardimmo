export type SpaceName = 'locataire' | 'proprietaire' | 'agence';

type Target = 'auth' | SpaceName;

const DEV_URLS: Record<Target, string> = {
  auth: 'http://localhost:3040',
  locataire: 'http://localhost:3030',
  proprietaire: 'http://localhost:3020',
  agence: 'http://localhost:3010',
};

const VARIABLES: Record<Target, string> = {
  auth: 'NEXT_PUBLIC_AUTH_URL',
  locataire: 'NEXT_PUBLIC_LOCATAIRE_URL',
  proprietaire: 'NEXT_PUBLIC_PROPRIETAIRE_URL',
  agence: 'NEXT_PUBLIC_AGENCE_URL',
};

// Next n'inline que les lectures littérales de process.env.NEXT_PUBLIC_*.
function configured(target: Target): string | undefined {
  switch (target) {
    case 'auth':
      return process.env.NEXT_PUBLIC_AUTH_URL;
    case 'locataire':
      return process.env.NEXT_PUBLIC_LOCATAIRE_URL;
    case 'proprietaire':
      return process.env.NEXT_PUBLIC_PROPRIETAIRE_URL;
    case 'agence':
      return process.env.NEXT_PUBLIC_AGENCE_URL;
  }
}

function isLocalHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.localhost') || hostname.endsWith('.test');
}

function normalize(variable: string, raw: string, production: boolean): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${variable} n’est pas une adresse valide : « ${raw} ».`);
  }
  const valid =
    (url.protocol === 'https:' || (url.protocol === 'http:' && (!production || isLocalHost(url.hostname)))) &&
    url.username === '' &&
    url.password === '' &&
    url.pathname === '/' &&
    url.search === '' &&
    url.hash === '';
  if (!valid) {
    throw new Error(
      `${variable} doit être une origine https:// sans chemin ni identifiants (http:// n’est admis que pour un hôte local) : « ${raw} ».`,
    );
  }
  return url.origin;
}

function baseOf(target: Target): string {
  const variable = VARIABLES[target];
  const production = process.env.NODE_ENV === 'production';
  const value = configured(target)?.trim();
  if (value) return normalize(variable, value, production);
  if (production) {
    throw new Error(`${variable} n’est pas défini : l’adresse « ${target} » ne peut pas être devinée en production.`);
  }
  return DEV_URLS[target];
}

function hasControlCharacter(value: string): boolean {
  return Array.from(value).some((char) => {
    const code = char.charCodeAt(0);
    return code <= 0x1f || code === 0x7f;
  });
}

function checkedPath(path: string): string {
  const internal =
    path.startsWith('/') &&
    !path.startsWith('//') &&
    !path.startsWith('/\\') &&
    !hasControlCharacter(path) &&
    new URL(path, 'http://interne.invalid').host === 'interne.invalid';
  if (!internal) throw new Error(`Chemin invalide pour un lien inter-applications : « ${path} ».`);
  return path;
}

export function authUrl(path: string): string {
  return `${baseOf('auth')}${checkedPath(path)}`;
}

export function spaceUrl(space: SpaceName, path: string): string {
  return `${baseOf(space)}${checkedPath(path)}`;
}

export function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href);
}
