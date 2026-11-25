import { siteEnv } from "./env";

export type SpaceKey = "agence" | "proprietaire" | "locataire" | "sebook";

export interface SpaceLink {
  key: SpaceKey;
  label: string;
  description: string;
  href: string;
}

const SPACES: readonly { key: SpaceKey; label: string; description: string }[] = [
  { key: "agence", label: "Espace agence", description: "Baux, loyers, mandats et équipe." },
  { key: "proprietaire", label: "Espace propriétaire", description: "Relevés, documents et fiscalité." },
  { key: "locataire", label: "Espace locataire", description: "Loyers, quittances et demandes." },
  { key: "sebook", label: "SeBook", description: "Annonces et réservations de courte durée." },
];

export function spaceLinks(): SpaceLink[] {
  const env = siteEnv();
  const hrefs: Record<SpaceKey, string> = {
    agence: env.NEXT_PUBLIC_AGENCE_URL,
    proprietaire: env.NEXT_PUBLIC_PROPRIETAIRE_URL,
    locataire: env.NEXT_PUBLIC_LOCATAIRE_URL,
    sebook: env.NEXT_PUBLIC_SEBOOK_URL,
  };
  return SPACES.map((space) => ({ ...space, href: hrefs[space.key] }));
}

export function loginUrl(): string {
  return siteEnv().NEXT_PUBLIC_AUTH_URL;
}
