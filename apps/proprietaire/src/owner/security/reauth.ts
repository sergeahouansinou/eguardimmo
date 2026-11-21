import { authLink } from "../session";

export const CONFIRMATION_PATH = "/compte/securite/confirmation/code";
export const PASSWORD_CONFIRMATION_PATH = "/compte/securite/confirmation";
export const TWO_FACTOR_SETUP_PATH = "/compte/securite/double-authentification";

export function reauthHref(authUrl: string | undefined, returnTo: string): string | null {
  const base = authLink(authUrl, CONFIRMATION_PATH);
  if (base === null) return null;
  const target = new URL(base);
  target.searchParams.set("exige", "code");
  target.searchParams.set("suite", `/continuer?return_to=${encodeURIComponent(returnTo)}`);
  return target.toString();
}

export function passwordReauthHref(authUrl: string | undefined, returnTo: string): string | null {
  const base = authLink(authUrl, PASSWORD_CONFIRMATION_PATH);
  if (base === null) return null;
  const target = new URL(base);
  target.searchParams.set("suite", `/continuer?return_to=${encodeURIComponent(returnTo)}`);
  return target.toString();
}

export function twoFactorSetupHref(authUrl: string | undefined): string | null {
  return authLink(authUrl, TWO_FACTOR_SETUP_PATH);
}

export function currentPageUrl(): string {
  const url = new URL(window.location.href);
  url.hash = "";
  return url.toString();
}
