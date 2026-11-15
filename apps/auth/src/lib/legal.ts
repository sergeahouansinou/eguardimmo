const LEGAL_BASE_URL = process.env.NEXT_PUBLIC_LEGAL_BASE_URL ?? "https://eguardimmo.example";

export const LEGAL_LINKS = [
  { label: "Politique de confidentialité", href: `${LEGAL_BASE_URL}/confidentialite` },
  { label: "Conditions d’utilisation", href: `${LEGAL_BASE_URL}/conditions` },
  { label: "À propos", href: `${LEGAL_BASE_URL}/a-propos` },
] as const;

export const COPYRIGHT = "© 2026 eGuardImmo";
