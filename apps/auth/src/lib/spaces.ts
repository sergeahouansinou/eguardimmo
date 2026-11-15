export type AppKind = "agence" | "proprietaire" | "locataire" | "sebook";

export type ProfileKind = "agence" | "bailleur" | "proprietaire" | "locataire" | "voyageur";

export const APP_LABELS: Record<AppKind, string> = {
  agence: "Espace agence",
  proprietaire: "Espace propriétaire",
  locataire: "Espace locataire",
  sebook: "SeBook",
};

export const PROFILE_LABELS: Record<ProfileKind, string> = {
  agence: "Espace agence",
  bailleur: "Espace bailleur",
  proprietaire: "Espace propriétaire",
  locataire: "Espace locataire",
  voyageur: "Espace voyageur",
};

const PROFILE_APPS: Record<ProfileKind, AppKind> = {
  agence: "agence",
  bailleur: "proprietaire",
  proprietaire: "proprietaire",
  locataire: "locataire",
  voyageur: "sebook",
};

export function appOfProfile(kind: ProfileKind): AppKind {
  return PROFILE_APPS[kind];
}

const LOCAL_PORTS: Record<string, AppKind> = {
  "3010": "agence",
  "3020": "proprietaire",
  "3030": "locataire",
};

const SUBDOMAINS: Record<string, AppKind> = {
  agence: "agence",
  proprietaire: "proprietaire",
  locataire: "locataire",
  sebook: "sebook",
};

export function appOfHost(host: string): AppKind | null {
  const [name = "", port = ""] = host.split(":");
  if (name === "localhost" || name === "127.0.0.1") return LOCAL_PORTS[port] ?? null;
  const first = name.split(".")[0] ?? "";
  return SUBDOMAINS[first] ?? null;
}
