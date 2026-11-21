import { isInternalPath } from "./returnTo";

export const ROUTES = {
  connexion: "/connexion",
  inscription: "/inscription",
  motDePasseOublie: "/mot-de-passe-oublie",
  profils: "/profils",
  continuer: "/continuer",
  accesRefuse: "/acces-refuse",
  deconnecte: "/deconnecte",
  sessionExpiree: "/session-expiree",
  retourRefuse: "/retour-refuse",
  verificationEmail: "/verification-email",
  lienExpire: "/lien-expire",
  invitationLocataire: "/invitation-locataire",
  invitationProprietaire: "/invitation-proprietaire",
  compte: "/compte/securite",
  comptesLies: "/compte/comptes-lies",
  appareils: "/compte/appareils",
  supprimer: "/compte/supprimer",
  confirmation: "/compte/securite/confirmation",
  doubleAuthentification: "/compte/securite/double-authentification",
  codesSecours: "/compte/securite/codes-de-secours",
} as const;

export interface RouteContext {
  returnTo?: string | null;
  suite?: string | null;
}

export function withContext(path: string, context: RouteContext = {}, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams();
  if (context.returnTo) params.set("return_to", context.returnTo);
  if (context.suite && isInternalPath(context.suite)) params.set("suite", context.suite);
  for (const [key, value] of Object.entries(extra)) params.set(key, value);
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}
