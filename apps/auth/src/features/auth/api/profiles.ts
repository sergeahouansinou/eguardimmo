import { apiProfileSchema, organizationMetaSchema } from "@eguardimmo/api";
import type { ApiProfile } from "@eguardimmo/api";
import { z } from "zod";
import type { Profile } from "../schemas";
import { parseResponse } from "./shared";

export const profilesResponseSchema = z.object({ data: z.array(apiProfileSchema) });

const ROLE_LABELS = {
  owner: "Titulaire du compte",
  admin: "Administrateur",
  manager: "Gestionnaire",
  accountant: "Comptable",
} as const;

function toProfile(profile: ApiProfile): Profile | null {
  switch (profile.space) {
    case "operator":
      return null;
    case "tenant":
      return {
        id: "tenant",
        kind: "locataire",
        title: "Espace locataire",
        subtitle: profile.label,
        summary: "Loyers, documents et échanges avec votre gestionnaire",
        badge: null,
        lastUsed: false,
      };
    case "owner":
      return {
        id: "owner",
        kind: "proprietaire",
        title: "Espace propriétaire",
        subtitle: profile.label,
        summary: "Suivi de vos biens confiés en gestion",
        badge: null,
        lastUsed: false,
      };
    case "organization": {
      const meta = parseResponse(organizationMetaSchema, profile.meta);
      return {
        id: meta.organization,
        kind: meta.kind === "agency" ? "agence" : "bailleur",
        title: meta.kind === "agency" ? "Espace agence" : "Espace bailleur",
        subtitle: profile.label,
        summary: ROLE_LABELS[meta.role],
        badge: null,
        lastUsed: false,
      };
    }
  }
}

export function toProfiles(payload: unknown): Profile[] {
  return parseResponse(profilesResponseSchema, payload).data.flatMap((profile) => toProfile(profile) ?? []);
}
