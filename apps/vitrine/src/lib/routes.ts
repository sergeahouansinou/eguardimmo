export const NAV_ROUTES = [
  { href: "/agences", label: "Agences" },
  { href: "/proprietaires", label: "Propriétaires" },
  { href: "/locataires", label: "Locataires" },
  { href: "/tarifs", label: "Tarifs" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
] as const;

export const LEGAL_ROUTES = [
  { href: "/mentions-legales", label: "Mentions légales" },
  { href: "/confidentialite", label: "Confidentialité" },
] as const;

export const SITEMAP_PATHS = ["/", ...NAV_ROUTES.map((route) => route.href), ...LEGAL_ROUTES.map((route) => route.href)] as const;
