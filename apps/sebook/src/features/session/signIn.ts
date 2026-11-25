export function authLink(authUrl: string | undefined, path: string, returnTo?: string): string | null {
  if (!authUrl) return null;
  const url = new URL(path, authUrl);
  if (returnTo) url.searchParams.set("return_to", returnTo);
  return url.toString();
}

export function signInHref(authUrl: string | undefined, returnTo: string): string | null {
  return authLink(authUrl, "/connexion", returnTo);
}

export function signUpHref(authUrl: string | undefined, returnTo: string): string | null {
  return authLink(authUrl, "/inscription/voyageur", returnTo);
}

export function currentPageUrl(): string {
  const url = new URL(window.location.href);
  url.hash = "";
  return url.toString();
}

export function hostSignUpHref(authUrl: string | undefined): string | null {
  return authLink(authUrl, "/inscription");
}

export function verifyEmailHref(authUrl: string | undefined, returnTo: string): string | null {
  return authLink(authUrl, "/verification-email", returnTo);
}
