import { CONFIE_BASE } from "@/features/confie/routes";

const OUTSIDE = "/ext";

// La coquille compare les chemins par préfixe : « /confie » serait actif sur toutes les pages.
// Elle ne voit donc que des chemins relatifs à l'espace, convertis en vrais liens ici.
export function toShellHref(realHref: string): string {
  if (realHref === CONFIE_BASE) return "/";
  if (realHref.startsWith(`${CONFIE_BASE}/`)) return realHref.slice(CONFIE_BASE.length);
  return realHref === "/" ? OUTSIDE : `${OUTSIDE}${realHref}`;
}

export function toRealHref(shellHref: string): string {
  if (shellHref === "/") return CONFIE_BASE;
  if (shellHref === OUTSIDE) return "/";
  if (shellHref.startsWith(`${OUTSIDE}/`)) return shellHref.slice(OUTSIDE.length);
  return `${CONFIE_BASE}${shellHref}`;
}

export function toShellPath(pathname: string): string {
  if (pathname === CONFIE_BASE || pathname.startsWith(`${CONFIE_BASE}/`)) return toShellHref(pathname);
  return `${OUTSIDE}${pathname === "/" ? "" : pathname}`;
}
