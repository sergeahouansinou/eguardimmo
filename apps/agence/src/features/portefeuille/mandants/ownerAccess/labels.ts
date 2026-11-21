import type { OwnerRole } from "./schemas";

export const OWNER_ROLE_LABELS: Record<OwnerRole, string> = {
  holder: "Titulaire",
  representative: "Représentant de la société",
  co_owner: "Co-indivisaire (lecture seule)",
};

export const OWNER_ROLE_HINTS: Record<OwnerRole, string> = {
  holder: "Le mandant lui-même, avec son propre compte.",
  representative: "Une personne habilitée à agir pour la société mandante.",
  co_owner: "Une autre personne du mandat, qui consulte sans pouvoir agir.",
};

export type MandantKind = "particulier" | "societe";

export function rolesFor(kind: MandantKind): readonly OwnerRole[] {
  return kind === "societe" ? ["representative", "co_owner"] : ["holder", "co_owner"];
}
