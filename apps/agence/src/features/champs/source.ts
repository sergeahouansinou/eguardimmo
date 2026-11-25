import type { ApiClient } from "@eguardimmo/api";
import { createOrgTransport } from "@/features/org/transport";
import { customFieldResponse, customFieldsResponse } from "./schemas";
import type { CustomField, Entity, FieldPayload } from "./schemas";

export interface ChampsSource {
  list: (entity: Entity, includeArchived: boolean) => Promise<CustomField[]>;
  create: (entity: Entity, payload: FieldPayload) => Promise<CustomField>;
  update: (id: string, payload: FieldPayload) => Promise<CustomField>;
  archive: (id: string) => Promise<CustomField>;
  restore: (id: string) => Promise<CustomField>;
}

const MESSAGES: Readonly<Record<string, string>> = {
  role_forbidden: "Seuls le titulaire et les administrateurs de l’agence modifient les champs personnalisés.",
  custom_field_not_found: "Ce champ n’existe plus dans votre organisation : rechargez la liste.",
  custom_field_key_taken: "Un champ de cet objet porte déjà cette clé.",
  custom_field_type_locked: "Le type d’un champ ne change plus dès qu’une valeur existe, et ses options ne peuvent qu’être complétées.",
  custom_field_limit_reached: "Le nombre maximal de champs personnalisés pour cet objet est atteint.",
};

function body(payload: FieldPayload, withKey: boolean): Record<string, unknown> {
  return {
    ...(withKey && payload.key !== undefined ? { key: payload.key } : {}),
    labels: payload.labels,
    type: payload.type,
    vocabulary: payload.vocabulary,
    options: payload.options,
    required: payload.required,
  };
}

export function createApiChampsSource(options: { client: ApiClient; organizationId: string | null }): ChampsSource {
  const transport = createOrgTransport(options.client, options.organizationId, { messages: MESSAGES });
  const archivePath = (id: string) => `/catalog/custom-fields/${encodeURIComponent(id)}/archive`;
  return {
    list: (entity, includeArchived) => transport.get(`/catalog/custom-fields/${entity}`, customFieldsResponse, includeArchived ? { include_archived: 1 } : undefined),
    create: (entity, payload) => transport.post(`/catalog/custom-fields/${entity}`, customFieldResponse, body(payload, true)),
    update: (id, payload) => transport.patch(`/catalog/custom-fields/${encodeURIComponent(id)}`, customFieldResponse, body(payload, false)),
    archive: (id) => transport.post(archivePath(id), customFieldResponse),
    restore: (id) => transport.delete(archivePath(id), customFieldResponse),
  };
}
