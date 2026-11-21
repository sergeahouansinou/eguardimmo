export const CONFIRMATION_PATH = '/compte/securite/confirmation';

export function reauthHref(authUrl: string | undefined, returnTo: string): string | null {
  if (!authUrl) return null;
  const target = new URL(CONFIRMATION_PATH, authUrl);
  target.searchParams.set('suite', `/continuer?return_to=${encodeURIComponent(returnTo)}`);
  return target.toString();
}

export function currentPageUrl(): string {
  const url = new URL(window.location.href);
  url.hash = '';
  return url.toString();
}
