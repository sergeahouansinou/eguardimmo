const DEV_LEGAL_BASE_URL = "https://eguardimmo.example";

export interface LegalLink {
  label: string;
  href: string;
}

export function legalBaseUrl(raw: string | undefined, nodeEnv: string | undefined): string | null {
  const value = raw?.trim();
  if (!value) return nodeEnv === "production" ? null : DEV_LEGAL_BASE_URL;
  try {
    const url = new URL(value);
    const allowed = url.protocol === "https:" || (url.protocol === "http:" && nodeEnv !== "production");
    return allowed ? `${url.origin}${url.pathname.replace(/\/+$/, "")}` : null;
  } catch {
    return null;
  }
}

export function legalLinks(baseUrl: string | null): { all: readonly LegalLink[]; terms: LegalLink | null } {
  if (baseUrl === null) return { all: [], terms: null };
  const terms = { label: "Conditions d’utilisation", href: `${baseUrl}/conditions` };
  return {
    all: [{ label: "Politique de confidentialité", href: `${baseUrl}/confidentialite` }, terms, { label: "À propos", href: `${baseUrl}/a-propos` }],
    terms,
  };
}

const links = legalLinks(legalBaseUrl(process.env.NEXT_PUBLIC_LEGAL_BASE_URL, process.env.NODE_ENV));

export const LEGAL_LINKS = links.all;
export const TERMS_LINK = links.terms;

export const COPYRIGHT = "© 2026 eGuardImmo";
